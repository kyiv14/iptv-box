// Вспомогательная функция для удаления файла по имени
async function deleteFileFromGitHub(filename, sha, token) {
    const apiUrl = `https://api.github.com/repos/kyiv14/iptv-box/contents/${filename}`;
    
    const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
            message: `Автоматическое удаление просроченного файла: ${filename}`,
            sha: sha,
            branch: 'main' // или REPO_CONFIG.branch
        })
    });
    
    if (!response.ok) {
        console.error(`Ошибка удаления ${filename}: ${response.status}`);
        return false;
    }
    return true;
}

// ПРИМЕР ФУНКЦИИ CLEANUP_FILES.JS
/*
exports.handler = async (event, context) => {
    // 1. Получить список клиентов
    // 2. Проверить даты (test_end_date)
    // 3. Если истекло:
    //      a. Получить SHA файла "public/test{phone}.m3u"
    //      b. Вызвать await deleteFileFromGitHub(...)
    // 4. Вернуть успешный ответ
};
*/