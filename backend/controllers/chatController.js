const { processChatMessage, getWarehouseOverview, getSupplyChainExternalContext } = require('../services/chatAgent.service');

// POST /api/chat — Gửi tin nhắn tới AI Chatbot
exports.sendMessage = async (req, res) => {
  try {
    const { message, history, scenario } = req.body;
    const user = req.user || { full_name: 'Thủ kho' };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Nội dung tin nhắn không hợp lệ.' });
    }

    const response = await processChatMessage({
      message,
      history: Array.isArray(history) ? history : [],
      user,
      scenario: scenario || req.headers['x-scenario'] || 'NORMAL',
    });

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...response,
    });
  } catch (error) {
    console.error('chatController.sendMessage error:', error);
    return res.status(500).json({
      error: 'Lỗi hệ thống khi xử lý câu hỏi của AI Copilot.',
      details: error.message,
    });
  }
};

// GET /api/chat/overview — Báo cáo nhanh tình hình kho
exports.getOverview = async (req, res) => {
  try {
    const overview = await getWarehouseOverview();
    const external = getSupplyChainExternalContext();

    return res.json({
      overview,
      external,
    });
  } catch (error) {
    console.error('chatController.getOverview error:', error);
    return res.status(500).json({ error: 'Không thể lấy dữ liệu tổng quan.' });
  }
};

