const globalFetch = global.fetch || require('node-fetch');
const nodemailer = require('nodemailer');

/**
 * Tạo transporter gửi email qua SMTP nếu đã cấu hình trong .env.
 */
function getTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_PORT === '465', // true cho 465, false cho các cổng khác
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return null;
}

/**
 * Gửi email cảnh báo tồn kho thấp tới admin.
 * @param {Array<{product_code:string, product_name:string, current_stock:number, min_stock:number, shortage:number}>} products
 * @param {string} toEmail
 */
async function sendLowStockAlert(products, toEmail) {
  const rows = products
    .map(
      (p) =>
        `<tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.product_code}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.product_name}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.current_stock}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.min_stock}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #e11d48;"><strong>${p.shortage}</strong></td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0e7490; margin-bottom: 16px; border-bottom: 2px solid #0e7490; padding-bottom: 8px;">⚠️ Cảnh báo tồn kho thấp — WMS</h2>
      <p style="font-size: 14px; color: #334155;">Hệ thống phát hiện có <strong>${products.length}</strong> sản phẩm dưới ngưỡng an toàn tối thiểu:</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px; border: 1px solid #ddd;">
        <thead>
          <tr style="background: #0e7490; color: #fff;">
            <th style="padding: 10px;">Mã SP</th>
            <th style="padding: 10px;">Tên sản phẩm</th>
            <th style="padding: 10px;">Tồn hiện tại</th>
            <th style="padding: 10px;">Tồn tối thiểu</th>
            <th style="padding: 10px;">Thiếu hụt</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top: 20px; color: #64748b; font-size: 12px; border-top: 1px dashed #e2e8f0; padding-top: 10px; text-align: center;">
        Email gửi tự động từ hệ thống quản lý kho WMS (Đồ án Lập trình Web INT1334).
      </p>
    </div>
  `;

  const subject = `[WMS] Cảnh báo ${products.length} sản phẩm tồn kho thấp`;
  const transporter = getTransporter();

  if (transporter) {
    console.log(`[SMTP] Sending low stock alert email to ${toEmail}...`);
    await transporter.sendMail({
      from: `"WMS Logistics" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: html,
    });
    return { success: true, method: 'SMTP' };
  }

  // Fallback sang Resend API
  console.log(`[Resend] Fallback to Resend API for low stock alert to ${toEmail}...`);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình thông tin gửi email (EMAIL_USER/EMAIL_PASS hoặc RESEND_API_KEY).');
  }

  const fromEmail = "onboarding@resend.dev";
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: subject,
      html: html,
    }),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || `Lỗi từ Resend API (HTTP ${response.status})`);
  }

  return resData;
}

/**
 * Gửi email thông báo đã kiểm kho tới admin.
 * @param {object} receipt
 * @param {string} toEmail
 */
async function sendInspectionAlert(receipt, toEmail) {
  const inspectorName = receipt.inspector?.full_name || 'Nhân viên kho';
  const inspectorEmail = receipt.inspector?.email || 'Chưa cấu hình email';
  const issueNotes = receipt.issue_notes || 'Không có';
  
  const rows = receipt.details
    .map(
      (d) => {
        const prodCode = d.product?.product_code || '—';
        const prodName = d.product?.name || '—';
        const received = d.received_quantity ?? 0;
        const accepted = d.accepted_quantity ?? 0;
        const rejected = d.rejected_quantity ?? 0;
        const batch = d.batch_code || '—';
        const mfg = d.mfg_date ? new Date(d.mfg_date).toLocaleDateString('vi-VN') : '—';
        const exp = d.expiry_date ? new Date(d.expiry_date).toLocaleDateString('vi-VN') : '—';
        const loc = d.lot_location?.location_code || '—';

        return `<tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${prodCode}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${prodName}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${received}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #10b981;"><strong>${accepted}</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #ef4444;">${rejected}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${batch}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${mfg} / ${exp}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${loc}</td>
        </tr>`;
      }
    )
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <h2 style="color: #4f46e5; margin-bottom: 16px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">📋 Thông báo: Đã kiểm tra hàng hoá</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Kính gửi Quản trị viên,<br/>
        Phiếu nhập kho <strong>${receipt.receipt_code}</strong> đã được hoàn tất kiểm kho bởi nhân viên. Dưới đây là thông tin chi tiết:
      </p>
      
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #f1f5f9;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 150px;">Mã phiếu nhập:</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: bold;">${receipt.receipt_code}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Nhà cung cấp:</td>
            <td style="padding: 4px 0; color: #0f172a;">${receipt.supplier?.name || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Nhân viên kiểm kho:</td>
            <td style="padding: 4px 0; color: #0f172a;">${inspectorName} (${inspectorEmail})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Thời gian kiểm:</td>
            <td style="padding: 4px 0; color: #0f172a;">${new Date(receipt.inspected_at || new Date()).toLocaleString('vi-VN')}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Ghi chú vấn đề:</td>
            <td style="padding: 4px 0; color: #e11d48; font-style: italic;">${issueNotes}</td>
          </tr>
        </table>
      </div>

      <h3 style="color: #0f172a; margin-top: 24px; font-size: 16px;">Chi tiết sản phẩm đã kiểm</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 13px; border: 1px solid #ddd; margin-top: 10px;">
        <thead>
          <tr style="background: #4f46e5; color: #fff;">
            <th style="padding: 8px; text-align: left;">Mã SP</th>
            <th style="padding: 8px; text-align: left;">Tên sản phẩm</th>
            <th style="padding: 8px; text-align: center;">SL nhận</th>
            <th style="padding: 8px; text-align: center;">SL Đạt</th>
            <th style="padding: 8px; text-align: center;">SL Lỗi</th>
            <th style="padding: 8px; text-align: center;">Mã lô</th>
            <th style="padding: 8px; text-align: center;">NSX / HSD</th>
            <th style="padding: 8px; text-align: center;">Vị trí kệ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top: 28px; text-align: center;">
        <a href="${process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard/imports/${receipt.id}" 
           style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Đi tới Duyệt nhập kho
        </a>
      </div>

      <p style="margin-top: 30px; color: #64748b; font-size: 12px; border-top: 1px dashed #e2e8f0; padding-top: 10px; text-align: center;">
        Email gửi tự động từ hệ thống quản lý kho WMS.
      </p>
    </div>
  `;

  const subject = `[WMS] Phiếu nhập ${receipt.receipt_code} đã hoàn tất kiểm kho`;
  const transporter = getTransporter();

  if (transporter) {
    console.log(`[SMTP] Sending inspection alert email to ${toEmail}...`);
    const mailOptions = {
      from: `"WMS Logistics" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: html,
    };
    if (receipt.inspector?.email) {
      mailOptions.replyTo = receipt.inspector.email;
    }
    await transporter.sendMail(mailOptions);
    return { success: true, method: 'SMTP' };
  }

  // Fallback sang Resend API
  console.log(`[Resend] Fallback to Resend API for inspection alert to ${toEmail}...`);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình thông tin gửi email (EMAIL_USER/EMAIL_PASS hoặc RESEND_API_KEY).');
  }

  const fromEmail = "onboarding@resend.dev";
  const requestBody = {
    from: fromEmail,
    to: toEmail,
    subject: subject,
    html: html,
  };

  if (receipt.inspector?.email) {
    requestBody.replyTo = receipt.inspector.email;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const resData = await response.json();

  if (!response.ok) {
    throw new Error(resData.message || `Lỗi từ Resend API (HTTP ${response.status})`);
  }

  return resData;
}

module.exports = { sendLowStockAlert, sendInspectionAlert };
