// Serverless Function: api/playlist_link.js

// КОНФИГУРАЦИЯ (ПРОВЕРЬТЕ И ПРИ НЕОБХОДИМОСТИ ИЗМЕНИТЕ)
const GITHUB_OWNER = 'kyiv14';
const GITHUB_REPO = 'moe-iptv'; 
const CLIENTS_FILE_PATH = 'public/clients.json'; // Путь к файлу с данными клиентов
const TEST_DURATION_MS = 5 * 60 * 1000; // 5 минут в миллисекундах (300 000)

// URL для тестового и основного плейлиста
const TEST_PLAYLIST_URL = 'https://raw.githubusercontent.com/kyiv14/iptv-client/main/playlist.m3u8';
const BASE_URL = 'https://moe-iptv.vercel.app/'; // Базовый домен для основного плейлиста

/**
 * Вспомогательная функция для получения данных клиентов с GitHub.
 */
async function fetchClients() {
    // ВАЖНО: Используйте прямую (RAW) ссылку на ваш clients.json
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${CLIENTS_FILE_PATH}`;
    
    try {
        // Убедитесь, что эта ссылка доступна без аутентификации
        const response = await fetch(rawUrl, { cache: 'no-store' }); 
        if (!response.ok) {
            console.error(`Ошибка загрузки clients.json: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Ошибка при загрузке клиентов:", error.message);
        return null;
    }
}


// Основной обработчик Vercel Serverless Function
export default async function handler(req, res) {
    // Получаем номер телефона из query-параметров URL
    const { phone } = req.query; 

    if (!phone) {
        return res.status(400).send('Требуется параметр "phone"');
    }

    const clients = await fetchClients();
    if (!clients) {
        // Если данные не загружены, возвращаем ошибку
        return res.status(503).send('Сервис временно недоступен (ошибка загрузки данных).');
    }
    
    // Ищем клиента по номеру телефона
    const client = clients.find(c => c.phone === phone);

    if (!client || !client.registration_date) {
        // Если клиент не найден или нет даты регистрации (как вы видели ранее)
        return res.status(404).send('Клиент не найден или нет даты регистрации.');
    }

    // --- ЛОГИКА ОПРЕДЕЛЕНИЯ ПЛЕЙЛИСТА ---
    const registrationTime = new Date(client.registration_date).getTime();
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - registrationTime;

    let targetUrl;
    let filename;
    
    if (elapsedTime < TEST_DURATION_MS) {
        // Менее 5 минут прошло: даем тестовый плейлист
        targetUrl = TEST_PLAYLIST_URL; 
        filename = `test_playlist_${phone}.m3u8`;
    } else {
        // 5 минут прошло: даем основной плейлист
        targetUrl = `${BASE_URL}${phone}.m3u`;
        filename = `iptv_playlist_${phone}.m3u`;
    }
    // ------------------------------------

    try {
        // 1. Загружаем контент плейлиста
        const playlistResponse = await fetch(targetUrl);
        if (!playlistResponse.ok) {
            console.error(`Ошибка загрузки целевого плейлиста с URL: ${targetUrl}`);
            return res.status(502).send('Ошибка загрузки плейлиста с внешнего источника.');
        }
        const playlistContent = await playlistResponse.text();

        // 2. Устанавливаем заголовки для принудительного скачивания
        res.setHeader('Content-Type', 'application/x-mpegurl'); // MIME-тип для .m3u/.m3u8
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // 3. Отправляем контент с кодом 200 (OK)
        res.status(200).send(playlistContent);

    } catch (error) {
        console.error("Критическая ошибка при обработке плейлиста:", error);
        res.status(500).send('Внутренняя ошибка сервера при скачивании.');
    }
}