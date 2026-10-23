import type { SharedCopy } from '../ui-copy';
export default {
  close: 'Đóng', note: 'Lưu ý', continueQuestion: 'Tiếp tục?', gotIt: 'Đã hiểu', continue: 'Tiếp tục', cancel: 'Hủy',
  file: { label: 'Thả tệp vào đây', labelMany: 'Thả các tệp vào đây', choose: 'Chọn tệp', chooseMany: 'Chọn các tệp', upTo: 'tối đa', any: 'Mọi tệp', type: 'Không hỗ trợ loại tệp này.', size: 'Tệp này lớn hơn', count: 'Quá nhiều tệp. Tối đa:', remove: 'Xóa' },
  loader: { waiting: 'Sẵn sàng tải', loading: 'Đang tải tài nguyên…', verifying: 'Đang kiểm tra tính toàn vẹn…', initializing: 'Đang chuẩn bị bộ xử lý…', done: 'Tài nguyên đã sẵn sàng', error: 'Không tải được tài nguyên', failed: 'Kiểm tra kết nối và quyền truy cập rồi thử lại. Nội dung nhập được giữ nguyên.' },
  table: { search: 'Tìm bản ghi', columns: 'Cột', rows: 'Hàng', density: 'Mật độ', comfortable: 'Thoáng', compact: 'Gọn', copy: 'Sao chép', page: 'Trang', of: 'trên', showing: 'Đang hiển thị', noResults: 'Không có hàng phù hợp.', previous: 'Trang trước', next: 'Trang sau', sortAsc: 'Sắp xếp tăng dần', sortDesc: 'Sắp xếp giảm dần' },
  code: { copy: 'Sao chép mã', copied: 'Đã sao chép', error: 'Không sao chép được', unavailable: 'Chưa có quyền sao chép', title: 'Mã' }
} satisfies SharedCopy;
