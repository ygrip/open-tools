import type { SharedCopy } from '../ui-copy';
export default {
  close: 'ปิด', note: 'หมายเหตุ', continueQuestion: 'ดำเนินการต่อหรือไม่?', gotIt: 'เข้าใจแล้ว', continue: 'ดำเนินการต่อ', cancel: 'ยกเลิก',
  file: { label: 'วางไฟล์ที่นี่', labelMany: 'วางหลายไฟล์ที่นี่', choose: 'เลือกไฟล์', chooseMany: 'เลือกหลายไฟล์', upTo: 'สูงสุด', any: 'ไฟล์ทุกชนิด', type: 'ไม่รองรับไฟล์ชนิดนี้', size: 'ไฟล์นี้มีขนาดใหญ่กว่า', count: 'ไฟล์มากเกินไป สูงสุด:', remove: 'นำออก' },
  loader: { waiting: 'พร้อมโหลด', loading: 'กำลังโหลดทรัพยากร…', verifying: 'กำลังตรวจสอบความถูกต้องของทรัพยากร…', initializing: 'กำลังเตรียมเอนจิน…', done: 'ทรัพยากรพร้อม', error: 'โหลดทรัพยากรไม่ได้', failed: 'ตรวจสอบการเชื่อมต่อและสิทธิ์เข้าถึง แล้วลองอีกครั้ง ข้อมูลที่ป้อนไว้ยังอยู่' },
  table: { search: 'ค้นหาระเบียน', columns: 'คอลัมน์', rows: 'แถว', density: 'ความหนาแน่น', comfortable: 'สบายตา', compact: 'กระชับ', copy: 'คัดลอก', page: 'หน้า', of: 'จาก', showing: 'แสดง', noResults: 'ไม่มีแถวที่ตรงกัน', previous: 'หน้าก่อน', next: 'หน้าถัดไป', sortAsc: 'เรียงจากน้อยไปมาก', sortDesc: 'เรียงจากมากไปน้อย' },
  code: { copy: 'คัดลอกโค้ด', copied: 'คัดลอกแล้ว', error: 'คัดลอกไม่ได้', unavailable: 'ไม่มีสิทธิ์คัดลอก', title: 'โค้ด' }
} satisfies SharedCopy;
