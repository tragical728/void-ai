<?php
/*
 * VOID 28 - обработчик формы обратной связи.
 *
 * Кладётся в корень сайта на РОССИЙСКОМ хостинге. Работает только там:
 * на GitHub Pages PHP не выполняется, файл просто будет лежать без дела.
 *
 * Порядок действий важен юридически. Заявка сначала записывается в файл
 * на этом сервере, и только потом уходит уведомление на почту. Первичная
 * запись персональных данных происходит на территории России, как того
 * требует часть 5 статьи 18 152-ФЗ.
 *
 * После переезда поменяйте в assets/js/config.js обе строки endpoint
 * на 'form.php'.
 */

declare(strict_types=1);

// ---------------------------------------------------------------- настройки

/** Куда слать уведомление о новой заявке. */
const NOTIFY_TO = 'danil@void28.ru';

/** От кого. Адрес должен быть на вашем домене, иначе письмо уйдёт в спам. */
const NOTIFY_FROM = 'site@void28.ru';

/** Куда возвращать человека после успешной отправки. */
const THANKS_URL = '/thanks.html';

/** Не больше этого числа заявок с одного адреса в час. */
const RATE_LIMIT = 5;

// ------------------------------------------------------------------ хранилище

/**
 * Каталог для заявок. Пытаемся положить их ВЫШЕ корня сайта, чтобы файл
 * нельзя было скачать по прямой ссылке. Если хостинг не даёт писать выше
 * корня, падаем на ./data и закрываем каталог через .htaccess.
 */
function storage_dir(): string
{
    $above = dirname(__DIR__) . '/void28-data';
    if (@is_dir($above) || @mkdir($above, 0750, true)) {
        return $above;
    }

    $inside = __DIR__ . '/data';
    if (!is_dir($inside)) {
        @mkdir($inside, 0750, true);
    }
    $guard = $inside . '/.htaccess';
    if (!file_exists($guard)) {
        @file_put_contents($guard, "Deny from all\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n");
    }
    return $inside;
}

// -------------------------------------------------------------- вспомогательное

function wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $ajax   = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    return str_contains($accept, 'application/json') || $ajax === 'XMLHttpRequest';
}

function finish(int $code, string $message): void
{
    if (wants_json()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $code === 200, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($code === 200) {
        header('Location: ' . THANKS_URL, true, 303);
        exit;
    }

    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

/** Обрезаем, чистим переводы строк в заголовках, снимаем управляющие символы. */
function field(string $name, int $max): string
{
    $raw = (string)($_POST[$name] ?? '');
    $raw = str_replace(["\r", "\0"], '', $raw);
    $raw = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $raw) ?? '';
    $raw = trim($raw);
    return mb_substr($raw, 0, $max);
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** Простой счётчик по часу и адресу. Без базы, одним файлом. */
function rate_ok(string $dir): bool
{
    $file = $dir . '/rate.json';
    $now  = time();
    $key  = hash('sha256', client_ip());

    $data = [];
    if (is_readable($file)) {
        $data = json_decode((string)file_get_contents($file), true) ?: [];
    }

    foreach ($data as $k => $entry) {
        if (($entry['t'] ?? 0) < $now - 3600) {
            unset($data[$k]);
        }
    }

    $hits = ($data[$key]['n'] ?? 0) + 1;
    $data[$key] = ['n' => $hits, 't' => $now];

    @file_put_contents($file, json_encode($data), LOCK_EX);
    return $hits <= RATE_LIMIT;
}

// ------------------------------------------------------------------- обработка

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    finish(405, 'Method not allowed');
}

// Ловушка для ботов: поле скрыто от людей, заполнить его может только робот.
// Отвечаем успехом, чтобы бот не понял, что его отсекли.
if (field('_honey', 200) !== '') {
    finish(200, 'ok');
}

$name    = field('name', 120);
$email   = field('email', 190);
$company = field('company', 160);
$service = field('service', 60);
$message = field('message', 4000);
$consent = isset($_POST['consent']);

if ($name === '' || $email === '' || $message === '') {
    finish(422, 'Заполните обязательные поля.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    finish(422, 'Проверьте адрес почты.');
}

// Без согласия персональные данные обрабатывать нельзя, поэтому и записи нет.
if (!$consent) {
    finish(422, 'Нужно согласие на обработку персональных данных.');
}

$dir = storage_dir();

if (!rate_ok($dir)) {
    finish(429, 'Слишком много обращений подряд. Попробуйте через час.');
}

// -------------------------------------------------- 1. запись на своём сервере

$row = [
    'ts'       => date('c'),
    'name'     => $name,
    'email'    => $email,
    'company'  => $company,
    'service'  => $service,
    'message'  => $message,
    'consent'  => 'yes',
    'ip'       => client_ip(),
    'ua'       => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
    'referer'  => mb_substr((string)($_SERVER['HTTP_REFERER'] ?? ''), 0, 300),
];

$csv = $dir . '/leads.csv';
$new = !file_exists($csv);

$fh = @fopen($csv, 'ab');
if ($fh === false) {
    // Записать не смогли - значит, принимать данные мы права не имеем.
    error_log('VOID28: не удалось открыть ' . $csv);
    finish(500, 'Заявка не сохранена. Напишите нам в Telegram: @voidmainer');
}

if (flock($fh, LOCK_EX)) {
    if ($new) {
        fwrite($fh, "\xEF\xBB\xBF");                 // BOM, чтобы Excel открыл в UTF-8
        fputcsv($fh, array_keys($row), ';');
    }
    fputcsv($fh, array_values($row), ';');
    flock($fh, LOCK_UN);
}
fclose($fh);
@chmod($csv, 0640);

// ------------------------------------------------------ 2. уведомление на почту

$lines = [
    'Новая заявка с сайта void28.ru',
    '',
    'Имя:      ' . $name,
    'Почта:    ' . $email,
    'Компания: ' . ($company !== '' ? $company : '-'),
    'Услуга:   ' . ($service !== '' ? $service : '-'),
    '',
    'Сообщение:',
    $message,
    '',
    '---',
    'Время:    ' . date('d.m.Y H:i'),
    'Адрес:    ' . client_ip(),
    'Согласие на обработку получено.',
];

$headers = implode("\r\n", [
    'From: VOID 28 <' . NOTIFY_FROM . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    'X-Mailer: void28-form',
]);

$subject = '=?UTF-8?B?' . base64_encode('VOID 28 - заявка от ' . $name) . '?=';

// Письмо это уведомление, а не хранилище. Если оно не ушло, заявка всё равно
// уже записана на сервере, поэтому человеку показываем успех.
@mail(NOTIFY_TO, $subject, implode("\n", $lines), $headers);

finish(200, 'ok');
