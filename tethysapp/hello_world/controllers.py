from tethys_sdk.routing import controller
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django import forms
from django.contrib import messages
from .models import MoHinh
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from django.shortcuts import render
from .minio_utils import list_buckets, upload_file

# Thay đổi thông tin kết nối cho phù hợp với hệ thống của bạn
DATABASE_URL = "postgresql://postgres:tranminh18@localhost:5432/hello_world_postgres"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

class MoHinhForm(forms.Form):
    ten = forms.CharField(label='Tên', max_length=100)
    mo_ta = forms.CharField(label='Mô tả', max_length=255, required=False)
    trang_thai = forms.ChoiceField(label='Trạng thái', choices=[('active', 'Đang hoạt động'), ('inactive', 'Ngừng')])
    legend = forms.CharField(label='Chú giải (JSON)', widget=forms.Textarea, required=False)

@controller
def home(request):
    import json
    session = Session()
    ds_mo_hinh = session.query(MoHinh).all()
    # Parse legend từ DB
    legend_data = {}
    for m in ds_mo_hinh:
        try:
            legend_data[m.id] = json.loads(m.legend) if m.legend else None
        except Exception:
            legend_data[m.id] = None
    session.close()
    return render(request, 'hello_world/home.html', {'models': ds_mo_hinh, 'legend_data': legend_data})


@controller
def model_list(request):
    session = Session()
    form_error = None
    edit_id = request.GET.get('edit_id')
    edit_form = None
    # Thêm mới mô hình
    if request.method == 'POST' and 'add_model' in request.POST:
        form = MoHinhForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            now = datetime.now()
            mo_hinh = MoHinh(
                ten=data['ten'],
                mo_ta=data['mo_ta'],
                trang_thai=data['trang_thai'],
                thoi_gian=now,
                thoi_gian_cap_nhat=now,
                legend=data.get('legend', '')
            )
            session.add(mo_hinh)
            session.commit()
            session.close()
            return redirect('hello_world:model_list')
        else:
            form_error = 'Dữ liệu không hợp lệ.'

    # Sửa mô hình inline
    if request.method == 'POST' and 'edit_model_id' in request.POST:
        edit_id = request.POST.get('edit_model_id')
        mo_hinh = session.query(MoHinh).filter(MoHinh.id == edit_id).first()
        form = MoHinhForm(request.POST)
        if form.is_valid() and mo_hinh:
            data = form.cleaned_data
            mo_hinh.ten = data['ten']
            mo_hinh.mo_ta = data['mo_ta']
            mo_hinh.trang_thai = data['trang_thai']
            mo_hinh.legend = data.get('legend', '')
            mo_hinh.thoi_gian_cap_nhat = datetime.now()
            session.commit()
            session.close()
            return redirect('hello_world:model_list')
        else:
            # Nếu lỗi, giữ lại form và hiển thị lại
            edit_form = form

    ds_mo_hinh = session.query(MoHinh).all()

    # Nếu có edit_id , tạo form sửa
    if edit_id and not edit_form:
        mo_hinh = session.query(MoHinh).filter(MoHinh.id == edit_id).first()
        if mo_hinh:
            edit_form = MoHinhForm(initial={
                'ten': mo_hinh.ten,
                'mo_ta': mo_hinh.mo_ta,
                'trang_thai': mo_hinh.trang_thai,
                'legend': mo_hinh.legend
            })

    context = {
        'ds_mo_hinh': ds_mo_hinh,
        'form_error': form_error,
        'edit_id': str(edit_id) if edit_id else '',
        'edit_form': edit_form
    }
    session.close()
    return render(request, 'hello_world/model_list.html', context)

# Controller sửa mô hình
@controller
def admin_sua_mo_hinh(request, id):
    session = Session()
    mo_hinh = session.query(MoHinh).filter(MoHinh.id == id).first()
    if not mo_hinh:
        session.close()
        return redirect('hello_world:model_list')
    if request.method == 'POST':
        form = MoHinhForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            mo_hinh.ten = data['ten']
            mo_hinh.mo_ta = data['mo_ta']
            mo_hinh.trang_thai = data['trang_thai']
            mo_hinh.thoi_gian_cap_nhat = datetime.now()
            session.commit()
            session.close()
            return redirect('hello_world:model_list')
    else:
        form = MoHinhForm(initial={
            'ten': mo_hinh.ten,
            'mo_ta': mo_hinh.mo_ta,
            'trang_thai': mo_hinh.trang_thai
        })
    session.close()
    return render(request, 'hello_world/sua_mo_hinh.html', {'form': form, 'mo_hinh': mo_hinh})

# Controller xóa mô hình
@controller
@csrf_exempt
def admin_xoa_mo_hinh(request, id):
    session = Session()
    mo_hinh = session.query(MoHinh).filter(MoHinh.id == id).first()
    if mo_hinh:
        session.delete(mo_hinh)
        session.commit()
    session.close()
    return redirect('hello_world:model_list')

# Controller quản lý MinIO

from django.http import JsonResponse
from .minio_utils import list_buckets, upload_file, list_files, delete_file

# Import hàm tạo bucket từ minio_utils (bạn cần có hàm này trong minio_utils.py)
try:
    from .minio_utils import create_bucket
except ImportError:
    create_bucket = None

@controller
def minio_admin(request):
    buckets = list_buckets()
    message = ""
    selected_bucket = request.POST.get('selected_bucket') or request.POST.get('bucket') or (buckets[0] if buckets else None)
    files = list_files(selected_bucket) if selected_bucket else []

    # Xử lý chọn bucket để hiển thị file
    if request.method == 'POST' and 'selected_bucket' in request.POST and not ('upload' in request.POST or 'delete_file' in request.POST):
        selected_bucket = request.POST['selected_bucket']
        files = list_files(selected_bucket)

    # Xử lý upload file
    if request.method == 'POST' and 'upload' in request.POST:
        bucket = request.POST['bucket']
        file = request.FILES.get('file')
        if bucket and file:
            try:
                upload_file(bucket, file, file.name)
                message = f"Upload thành công: {file.name}"
            except Exception as e:
                message = f"Lỗi upload: {str(e)}"
        selected_bucket = bucket
        files = list_files(bucket)

    # Xử lý xóa file
    if request.method == 'POST' and 'delete_file' in request.POST:
        bucket = request.POST['bucket']
        file_name = request.POST['delete_file']
        try:
            delete_file(bucket, file_name)
            message = f"Đã xóa file: {file_name}"
        except Exception as e:
            message = f"Lỗi xóa file: {str(e)}"
        selected_bucket = bucket
        files = list_files(bucket)

    context = {
        'buckets': buckets,
        'files': files,
        'message': message,
        'selected_bucket': selected_bucket
    }
    return render(request, 'hello_world/minio_admin.html', context)



# API: Lấy danh sách bucket và object (JSON)
@controller(url='hello-world/api/minio-list', app_name='hello_world')
def minio_list_api(request):
    buckets = list_buckets()
    data = []
    for bucket in buckets:
        objects = list_files(bucket)
        data.append({
            'bucket': bucket,
            'objects': objects
        })
    return JsonResponse({'buckets': data})

# API: Upload file vào bucket cụ thể
from django.views.decorators.csrf import csrf_exempt
@controller(url='hello-world/api/minio-upload/<bucket>', app_name='hello_world')
@csrf_exempt
def minio_upload_api(request, bucket):
    if request.method == 'POST' and request.FILES.get('file'):
        file = request.FILES['file']
        try:
            upload_file(bucket, file, file.name)
            return JsonResponse({'success': True, 'filename': file.name})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)


# API: Tạo bucket mới cho MinIO
@controller(url='hello-world/api/minio-create-bucket', app_name='hello_world')
@csrf_exempt
def minio_create_bucket_api(request):
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body.decode('utf-8'))
            bucket_name = data.get('bucket_name')
            if not bucket_name:
                return JsonResponse({'success': False, 'error': 'Bucket name is required.'}, status=400)
            if create_bucket is None:
                return JsonResponse({'success': False, 'error': 'create_bucket function not implemented.'}, status=500)
            create_bucket(bucket_name)
            return JsonResponse({'success': True, 'bucket': bucket_name})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)