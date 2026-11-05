export const CATEGORIES = ['Бот', 'Интеграция', 'Отчёт', 'Другое'];
export const STATUSES = ['Новая', 'В работе', 'Завершена'];

export function filterRequests(requests, search, status) {
  const query = search.trim().toLocaleLowerCase('ru');
  return requests.filter(request =>
    request.title.toLocaleLowerCase('ru').includes(query) &&
    (!status || request.status === status));
}

export function validateRequest(draft) {
  if (!draft.title.trim()) return 'Введите название заявки.';
  if (!draft.description.trim()) return 'Опишите, что нужно автоматизировать.';
  if (!CATEGORIES.includes(draft.category)) return 'Выберите категорию.';
  if (!STATUSES.includes(draft.status)) return 'Выберите допустимый статус.';
  return '';
}

export function errorMessage(error) {
  if (error?.message === 'Invalid login credentials') return 'Не удалось войти. Проверьте email и пароль.';
  if (error?.message === 'Email not confirmed') return 'Подтвердите email по ссылке в письме, затем войдите.';
  if (error?.code === 'over_email_send_rate_limit' || error?.status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  if (error?.code === '23505') return 'Заявка с этим номером уже сохранена. Обновите список, чтобы проверить результат.';
  if (error?.code === '42501') return 'Нет доступа к этой операции. Войдите повторно и попробуйте ещё раз.';
  return 'Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз.';
}
