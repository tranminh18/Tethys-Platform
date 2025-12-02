from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, DateTime

Base = declarative_base()

class MoHinh(Base):
    __tablename__ = 'mo_hinh'
    id = Column(Integer, primary_key=True, autoincrement=True)
    ten = Column(String(100), nullable=False)
    mo_ta = Column(String(255))
    thoi_gian = Column(DateTime)
    thoi_gian_cap_nhat = Column(DateTime)
    trang_thai = Column(String(50))
    legend = Column(String)  # Lưu JSON hoặc HTML cho chú giải

def init_my_db(engine, sessionmaker, *args, **kwargs):
    """
    Hàm khởi tạo persistent store, được Tethys gọi khi syncstores.
    """
    Base.metadata.create_all(engine)