from sqlalchemy import create_engine
from models import Base

# Thay đổi thông tin kết nối cho phù hợp với hệ thống của bạn
DATABASE_URL = "postgresql://postgres:tranminh18@localhost:5432/hello_world"
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(engine)
print("Đã tạo bảng thành công!")
