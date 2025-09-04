const express = require('express');
const fs = require('fs').promises; // 使用 promises 版本
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003; // 后端服务在容器内部监听的端口
const DATA_FILE = path.join('/app/backend', 'data.json'); // 容器内部 data.json 的路径

// 允许所有跨域请求 (在生产环境中应限制为您的前端域名)
app.use(cors());
app.use(express.json()); // 用于解析 JSON 格式的请求体

// 确保 data.json 文件存在，如果不存在则创建初始空数据
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE); // 尝试访问文件
        console.log('data.json already exists in container.');
    } catch (error) {
        if (error.code === 'ENOENT') { // 文件不存在
            const initialData = { categories: [], bookmarks: [], collapsedCategories: {} };
            await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
            console.log('data.json created with initial empty data in container.');
        } else {
            console.error('Error checking/creating data.json:', error);
        }
    }
}

// GET 请求：读取数据
app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading data.json:', error);
        // 如果文件不存在，返回初始空数据 (前端会处理)
        if (error.code === 'ENOENT') {
            return res.json({ categories: [], bookmarks: [], collapsedCategories: {} });
        }
        res.status(500).send('Error reading data');
    }
});

// POST 请求：保存数据
app.post('/api/data', async (req, res) => {
    try {
        const newData = req.body;
        await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2));
        res.status(200).send('Data saved successfully');
    } catch (error) {
        console.error('Error writing data.json:', error);
        res.status(500).send('Error saving data');
    }
});

// 启动服务器
initializeDataFile().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend server listening on port ${PORT}`);
    });
});
