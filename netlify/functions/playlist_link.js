// Netlify Function: netlify/functions/playlist_link.js

/**
 * ВАЖНО: 
 * Используются переменные окружения Netlify, установленные в UI.
 * * Требуемые ENV переменные:
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - CLIENTS_FILE_PATH (должно быть 'public/clients.json')
 * - BASE_URL (должно быть 'https://iptv-box.netlify.app/') 
 * - TEST_DURATION_MS (напр., 300000 для 5 минут)
 * - TEST_PLAYLIST_URL (напр., https://raw.githubusercontent.com/kyiv14/iptv-box/main/playlist.m3u8)
 */

const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const CLIENTS_FILE_PATH = process.env.CLIENTS_FILE_PATH;
const BASE_URL = process.env.BASE_URL; 
const TEST_DURATION_MS = parseInt(process.env.TEST_DURATION_MS, 10); 
const TEST_PLAYLIST_URL = process.env.TEST_PLAYLIST_URL; 

/**
 * Вспомогательная функция для получения данных клиентов с GitHub.
 */
async function fetchClients() {
    // Используем прямую (RAW) ссылку на clients.json
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${CLIENTS_FILE_PATH}`;
    
    try {
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


// Основной обработчик Netlify Function
exports.handler = async function(event, context) {
    // Получаем номер телефона из query-параметров
    const { phone } = event.queryStringParameters; 

    if (!phone) {
        return { statusCode: 400, body: 'Требуется параметр "phone"' };
    }

    const clients = await fetchClients();
    if (!clients) {
        return { statusCode: 503, body: 'Сервис временно недоступен (ошибка загрузки данных).' };
    }
    
    // Ищем клиента по номеру телефона
    const client = clients.find(c => c.phone === phone);

    if (!client || !client.registration_date) {
        return { statusCode: 404, body: 'Клиент не найден или нет даты регистрации.' };
    }

    // --- ЛОГИКА ОПРЕДЕЛЕНИЯ ПЛЕЙЛИСТА ---
    const registrationTime = new Date(client.registration_date).getTime();
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - registrationTime;

    let targetUrl;
    let filename;
    let contentType;
    
    if (elapsedTime < TEST_DURATION_MS && TEST_PLAYLIST_URL) {
        // Менее X минут прошло: даем тестовый плейлист (если URL указан)
        targetUrl = TEST_PLAYLIST_URL; 
        filename = `test_playlist_${phone}.m3u8`;
        contentType = 'application/x-mpegurl';
    } else {
        // Время прошло: даем основной плейлист
        // ВАЖНО: Клиентские плейлисты должны быть доступны в репозитории GitHub
        // по пути, указанному в BASE_URL + {phone}.m3u
        targetUrl = `${BASE_URL}${phone}.m3u`;
        filename = `iptv_playlist_${phone}.m3u`;
        contentType = 'application/x-mpegurl';
    }
    // ------------------------------------

    try {
        // 1. Загружаем контент плейлиста
        const playlistResponse = await fetch(targetUrl);
        if (!playlistResponse.ok) {
            console.error(`Ошибка загрузки целевого плейлиста с URL: ${targetUrl}`);
            return { statusCode: 502, body: 'Ошибка загрузки плейлиста с внешнего источника.' };
        }
        const playlistContent = await playlistResponse.text();

        // 2. Возвращаем ответ
        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType, 
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
            body: playlistContent
        };

    } catch (error) {
        console.error("Критическая ошибка при обработке плейлиста:", error);
        return { statusCode: 500, body: 'Внутренняя ошибка сервера при скачивании.' };
    }

}
