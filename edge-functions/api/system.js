/**
 * Tuzi Async Studio - System Info Edge Function
 * 用于检测系统运行环境和配置状态
 */

const VERSION = '1.0.0';

export async function onRequest(context) {
  const { request } = context;
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  const kvEnabled = typeof TUZI_KV !== 'undefined';
  
  const data = {
    code: 0,
    message: kvEnabled ? '系统配置正常' : 'KV 存储未绑定',
    version: VERSION,
    config: {
      kvEnabled: kvEnabled
    }
  };

  return new Response(JSON.stringify(data), {
    headers: getCorsHeaders(request)
  });
}

function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  };
}

export default { onRequest };
