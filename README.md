# bun-httpbin

一个用 Bun 原生 API 实现的轻量 httpbin 风格服务，目标是保留最常用的请求调试能力，同时坚持两条约束：

- 优先用 bun:test 写测试，再补核心功能
- 不安装第三方依赖，只使用 Bun 和标准 Web API

## 当前已实现

- GET /get
- POST /post
- PUT /put
- PATCH /patch
- DELETE /delete
- GET /headers
- GET /ip
- GET /user-agent

## 运行

```bash
pnpm install
bun run start
```

默认监听 <http://127.0.0.1:3000>。

## 测试

```bash
bun test
```

## 开发检查

```bash
pnpm run format
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run check
```

项目使用以下开发工具：

- @types/bun
- oxfmt
- oxlint
- typescript

## 示例

```bash
curl 'http://127.0.0.1:3000/get?hello=bun&hello=httpbin'

curl -X POST 'http://127.0.0.1:3000/post?debug=1' \
  -H 'content-type: application/json' \
  -d '{"runtime":"bun","ok":true}'

curl 'http://127.0.0.1:3000/headers' -H 'x-demo: 1'
```

## 兼容性说明

这个项目目前采取“功能近似”策略，而不是逐字段复制 postmanlabs/httpbin：

- 重复 query 参数会返回数组
- multipart 请求当前返回文件元信息，而不是文件内容
- 非法 JSON 会直接返回 400

后续可以继续补 status、redirect、cookies、auth、delay、stream 等端点。
