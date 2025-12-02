from minio import Minio

minio_client = Minio(
    "localhost:9000",  # Địa chỉ MinIO
    access_key="minioadmin",  # Thay bằng access key của bạn
    secret_key="minioadmin",  # Thay bằng secret key của bạn
    secure=False
)

def list_buckets():
    return [bucket.name for bucket in minio_client.list_buckets()]

def upload_file(bucket_name, file_data, file_name):
    # Đảm bảo lấy đúng size cho file_data (Django InMemoryUploadedFile/File)
    print(f"[UPLOAD] bucket={bucket_name}, file={file_name}")
    file_data.seek(0, 2)  # Seek to end
    size = file_data.tell()
    file_data.seek(0)     # Quay lại đầu file
    print(f"[UPLOAD] size={size}")
    minio_client.put_object(
        bucket_name,
        file_name,
        file_data,
        length=size,
        content_type=getattr(file_data, 'content_type', 'application/octet-stream')
    )
    print(f"[UPLOAD DONE] {file_name} uploaded to {bucket_name}")

def list_files(bucket_name):
    print(f"[LIST FILES] bucket={bucket_name}")
    objects = []
    for obj in minio_client.list_objects(bucket_name):
        print(f"[OBJECT] {obj.object_name} size={obj.size} last_modified={obj.last_modified}")
        objects.append({
            "name": obj.object_name,
            "last_modified": obj.last_modified.isoformat() if obj.last_modified else "",
            "size": obj.size
        })
    print(f"[LIST FILES DONE] total={len(objects)}")
    return objects

def delete_file(bucket_name, file_name):
    minio_client.remove_object(bucket_name, file_name)