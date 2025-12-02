from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

class Command(BaseCommand):
    help = 'Tạo các nhóm quyền Admin và User cho ứng dụng.'

    def handle(self, *args, **options):
        # Tạo nhóm Admin
        admin_group, created = Group.objects.get_or_create(name='Admin')
        if created:
            self.stdout.write(self.style.SUCCESS('Đã tạo nhóm Admin.'))
        else:
            self.stdout.write('Nhóm Admin đã tồn tại.')

        # Tạo nhóm User
        user_group, created = Group.objects.get_or_create(name='User')
        if created:
            self.stdout.write(self.style.SUCCESS('Đã tạo nhóm User.'))
        else:
            self.stdout.write('Nhóm User đã tồn tại.')

        # Gán quyền cho nhóm (ví dụ: tất cả quyền cho Admin, chỉ xem cho User)
        # Tuỳ chỉnh theo nhu cầu thực tế
        # admin_group.permissions.set(Permission.objects.all())
        # user_group.permissions.set([])  # hoặc chỉ quyền xem

        self.stdout.write(self.style.SUCCESS('Đã thiết lập nhóm quyền.'))
