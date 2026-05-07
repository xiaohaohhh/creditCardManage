function getRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
}

export function getServerStatusMessage(status: number, fallbackPrefix: string = '服务器错误'): string {
  switch (status) {
    case 400:
      return '请求参数有误，请检查输入内容';
    case 401:
      return '未通过身份验证，请重新登录或检查配置';
    case 403:
      return '服务器拒绝了当前请求';
    case 404:
      return '未找到对应的服务接口，请检查服务器地址';
    case 408:
      return '请求超时，请稍后重试';
    case 429:
      return '请求过于频繁，请稍后再试';
    case 500:
      return '服务器内部出错，请稍后重试';
    case 502:
      return '网关错误，后端服务可能未正常运行';
    case 503:
      return '服务暂时不可用，请稍后重试';
    case 504:
      return '网关超时，后端服务响应过慢';
    case 530:
      return '云端服务当前不可用（Cloudflare 530），请检查后端服务或隧道状态';
    default:
      return `${fallbackPrefix}：${status}`;
  }
}

export function toChineseErrorMessage(error: unknown, fallback: string): string {
  const rawMessage = getRawErrorMessage(error).trim();
  if (!rawMessage) {
    return fallback;
  }

  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('networkerror') || lowerMessage.includes('load failed')) {
    return '无法连接到服务器，请检查网络、服务地址或源站状态';
  }

  if (lowerMessage.includes('error code: 1033')) {
    return 'Cloudflare 无法连接到源站，请检查后端服务或隧道状态';
  }

  if (lowerMessage.includes('cloudflare') && lowerMessage.includes('530')) {
    return 'Cloudflare 无法连接到源站，请检查后端服务或隧道状态';
  }

  if (lowerMessage.includes('timeout')) {
    return '请求超时，请稍后重试';
  }

  if (lowerMessage.includes('abort')) {
    return '请求已中断，请重试';
  }

  if (lowerMessage.includes('unexpected token') || lowerMessage.includes('json')) {
    return '服务器返回了无法识别的数据，请检查后端服务是否正常';
  }

  const serverErrorMatch = lowerMessage.match(/服务器错误[:：]\s*(\d{3})/);
  if (serverErrorMatch) {
    return getServerStatusMessage(parseInt(serverErrorMatch[1], 10));
  }

  const englishServerErrorMatch = lowerMessage.match(/server error[:：]\s*(\d{3})/);
  if (englishServerErrorMatch) {
    return getServerStatusMessage(parseInt(englishServerErrorMatch[1], 10));
  }

  return rawMessage;
}
