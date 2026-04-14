import { createApp, computed, defineComponent, h, reactive, ref } from 'vue'
import ElementPlus, {
  ElAlert,
  ElButton,
  ElCard,
  ElDivider,
  ElInput,
  ElOption,
  ElScrollbar,
  ElSelect,
  ElTag,
  ElTooltip
} from 'element-plus'
import 'element-plus/dist/index.css'

import './styles.css'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

type EndpointPreset = {
  body?: string
  description: string
  headers?: Record<string, string>
  method: RequestMethod
  path: string
  title: string
}

type ResponseState = {
  body: string
  bodyKind: 'text' | 'json' | 'html' | 'binary'
  error: string
  headers: Array<[string, string]>
  loading: boolean
  status: number
  statusText: string
  url: string
}

type EndpointPresetGroup = {
  description: string
  items: EndpointPreset[]
  title: string
}

function createPreset(
  title: string,
  method: RequestMethod,
  path: string,
  description: string,
  extras: Pick<EndpointPreset, 'body' | 'headers'> = {}
): EndpointPreset {
  return {
    ...extras,
    description,
    method,
    path,
    title
  }
}

const endpointPresetGroups: EndpointPresetGroup[] = [
  {
    title: '页面与文档',
    description: '直接返回页面、文档和基础文本内容。',
    items: [
      createPreset('Home page', 'GET', '/', 'Open the legacy landing page.'),
      createPreset('HTML page', 'GET', '/html', 'Return the HTML compatibility page.'),
      createPreset('Legacy page', 'GET', '/legacy', 'Return the legacy landing page.'),
      createPreset('Forms page', 'GET', '/forms/post', 'Render the sample form page.'),
      createPreset('UTF-8 demo', 'GET', '/encoding/utf8', 'Display mixed-language UTF-8 content.'),
      createPreset('robots.txt', 'GET', '/robots.txt', 'Return the robots directive text.'),
      createPreset('Deny page', 'GET', '/deny', 'Return a forbidden-style response.'),
      createPreset('JSON spec', 'GET', '/json', 'Return the sample JSON document.'),
      createPreset('XML spec', 'GET', '/xml', 'Return the sample XML document.')
    ]
  },
  {
    title: '请求与回显',
    description: '观察请求本身、回显头部和不同 HTTP 方法。',
    items: [
      createPreset(
        'Echo request',
        'GET',
        '/get?hello=bun&hello=httpbin',
        'Inspect query parameters, headers, and request metadata.'
      ),
      createPreset(
        'Anything echo',
        'GET',
        '/anything?hello=bun&hello=httpbin',
        'Echo the base anything route and request metadata.'
      ),
      createPreset(
        'Anything nested',
        'GET',
        '/anything/foo/bar?hello=bun&hello=httpbin',
        'Echo any nested path and request metadata.'
      ),
      createPreset('Headers', 'GET', '/headers', 'Read the normalized request header map.'),
      createPreset('Client IP', 'GET', '/ip', 'Show the detected client IP address.'),
      createPreset('User agent', 'GET', '/user-agent', 'Verify the browser user agent string.'),
      createPreset('UUID', 'GET', '/uuid', 'Generate a version 4 UUID.'),
      createPreset(
        'POST echo',
        'POST',
        '/post',
        'Submit a structured request payload.',
        {
          body: '{\n  "runtime": "bun",\n  "ui": "element-plus"\n}',
          headers: {
            'content-type': 'application/json'
          }
        }
      ),
      createPreset('PUT echo', 'PUT', '/put', 'Echo a PUT request payload.'),
      createPreset('PATCH echo', 'PATCH', '/patch', 'Echo a PATCH request payload.'),
      createPreset('DELETE echo', 'DELETE', '/delete', 'Echo a DELETE request payload.')
    ]
  },
  {
    title: '认证与 cookies',
    description: '验证会话、认证和 cookie 相关接口。',
    items: [
      createPreset('Cookies', 'GET', '/cookies', 'Read the request cookies.'),
      createPreset(
        'Set cookies',
        'GET',
        '/cookies/set?flavor=chocolate',
        'Set cookies via query parameters.'
      ),
      createPreset(
        'Set cookie by name',
        'GET',
        '/cookies/set/flavor/chocolate',
        'Set a named cookie with a path parameter.'
      ),
      createPreset(
        'Delete cookies',
        'GET',
        '/cookies/delete?flavor=1',
        'Delete cookies via query parameters.'
      ),
      createPreset('Basic auth', 'GET', '/basic-auth/alice/secret', 'Test Basic auth handling.'),
      createPreset(
        'Hidden basic auth',
        'GET',
        '/hidden-basic-auth/alice/secret',
        'Return 404 when authentication fails.'
      ),
      createPreset('Bearer auth', 'GET', '/bearer', 'Test Bearer token handling.'),
      createPreset(
        'Digest auth',
        'GET',
        '/digest-auth/auth/alice/secret',
        'Test Digest auth with auth qop.'
      )
    ]
  },
  {
    title: '状态与重定向',
    description: '查看状态码、跳转链路和 link 页面。',
    items: [
      createPreset('Status 418', 'GET', '/status/418', 'Return a custom HTTP status and body.'),
      createPreset('Status 200', 'GET', '/status/200', 'Return a configurable status code.'),
      createPreset('Redirect chain', 'GET', '/redirect/2', 'Follow the absolute redirect chain.'),
      createPreset(
        'Relative redirect',
        'GET',
        '/relative-redirect/2',
        'Follow a relative redirect chain.'
      ),
      createPreset(
        'Absolute redirect',
        'GET',
        '/absolute-redirect/2',
        'Follow an absolute redirect chain.'
      ),
      createPreset(
        'Redirect to',
        'GET',
        '/redirect-to?url=%2Fget&status_code=302',
        'Redirect to a target URL from query parameters.'
      ),
      createPreset('Links', 'GET', '/links/3', 'Open the links landing page.'),
      createPreset('Links page', 'GET', '/links/3/1', 'Render a link page with an offset.')
    ]
  },
  {
    title: '缓存与响应',
    description: '检查缓存头、条件请求和可回显响应头。',
    items: [
      createPreset('Response headers', 'GET', '/response-headers?foo=bar', 'Echo query params as headers.'),
      createPreset('Response headers POST', 'POST', '/response-headers?foo=bar', 'Echo headers from a POST request.'),
      createPreset('Cache', 'GET', '/cache', 'Check ETag and Last-Modified handling.'),
      createPreset('Cache control', 'GET', '/cache/3600', 'Return a cache-control header.'),
      createPreset(
        'ETag',
        'GET',
        '/etag/demo',
        'Exercise conditional request handling.',
        {
          headers: {
            'if-none-match': 'demo'
          }
        }
      )
    ]
  },
  {
    title: '延迟与流式',
    description: '用于慢请求、分块流和流式字节内容。',
    items: [
      createPreset('Delay', 'GET', '/delay/1', 'Delay the response for one second.'),
      createPreset('Drip', 'GET', '/drip?duration=2&numbytes=4&delay=1', 'Stream bytes over time.'),
      createPreset('Stream', 'GET', '/stream/3', 'Return newline-delimited JSON lines.'),
      createPreset('Stream bytes', 'GET', '/stream-bytes/32', 'Stream a fixed number of bytes.')
    ]
  },
  {
    title: '二进制与媒体',
    description: '覆盖范围请求、基础编码、图片和压缩响应。',
    items: [
      createPreset('Range', 'GET', '/range/26', 'Request a byte range.'),
      createPreset('Bytes', 'GET', '/bytes/16', 'Return a deterministic byte payload.'),
      createPreset('Base64', 'GET', '/base64/aHR0cHViaW4=', 'Decode base64 content into text.'),
      createPreset('Image', 'GET', '/image', 'Return a negotiated image response.'),
      createPreset('PNG image', 'GET', '/image/png', 'Return a PNG image.'),
      createPreset('JPEG image', 'GET', '/image/jpeg', 'Return a JPEG image.'),
      createPreset('WEBP image', 'GET', '/image/webp', 'Return a WEBP image.'),
      createPreset('SVG image', 'GET', '/image/svg', 'Return an SVG image.'),
      createPreset('Gzip', 'GET', '/gzip', 'Return gzipped content.'),
      createPreset('Deflate', 'GET', '/deflate', 'Return deflated content.'),
      createPreset('Brotli', 'GET', '/brotli', 'Return brotli-compressed content.')
    ]
  }
]

const endpointPresets = endpointPresetGroups.flatMap((group) => group.items)

const requestMethods: RequestMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD'
]

const requestForm = reactive({
  bodyText: '',
  headersText: '{}',
  method: 'GET' as RequestMethod,
  path: '/get'
})

const responseState = reactive<ResponseState>({
  body: '',
  bodyKind: 'text',
  error: '',
  headers: [],
  loading: false,
  status: 0,
  statusText: '',
  url: ''
})

const lastRunLabel = ref('Ready')

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function previewBinary(bytes: Uint8Array, limit = 128): string {
  const slice = bytes.slice(0, limit)
  const hex = Array.from(slice, (byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')
    .trim()
  const suffix = bytes.length > limit ? `\n... ${bytes.length - limit} more bytes` : ''

  return `Binary payload (${bytes.length} bytes)\n\n${hex}${suffix}`
}

function parseHeaders(text: string): Record<string, string> {
  const trimmed = text.trim()

  if (!trimmed) {
    return {}
  }

  const value = JSON.parse(trimmed) as Record<string, unknown>
  const headers: Record<string, string> = {}

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === 'string') {
      headers[key] = rawValue
    }
  }

  return headers
}

function applyPreset(preset: EndpointPreset): void {
  requestForm.method = preset.method
  requestForm.path = preset.path
  requestForm.headersText = JSON.stringify(preset.headers ?? {}, null, 2)
  requestForm.bodyText = preset.body ?? ''
}

function isActivePreset(preset: EndpointPreset): boolean {
  return (
    requestForm.method === preset.method &&
    requestForm.path === preset.path &&
    requestForm.headersText === JSON.stringify(preset.headers ?? {}, null, 2) &&
    requestForm.bodyText === (preset.body ?? '')
  )
}

async function executeRequest(): Promise<void> {
  responseState.loading = true
  responseState.error = ''
  lastRunLabel.value = 'Sending request...'

  try {
    const headers = new Headers(parseHeaders(requestForm.headersText))
    const requestInit: RequestInit = {
      headers,
      method: requestForm.method
    }

    if (requestForm.method !== 'GET' && requestForm.method !== 'HEAD') {
      if (!headers.has('content-type') && requestForm.bodyText.trim()) {
        headers.set('content-type', 'application/json')
      }

      if (headers.get('content-type')?.includes('application/json')) {
        requestInit.body = prettyJson(requestForm.bodyText)
      } else if (requestForm.bodyText.length > 0) {
        requestInit.body = requestForm.bodyText
      }
    }

    const response = await fetch(requestForm.path, requestInit)
    const contentType = response.headers.get('content-type') ?? ''

    responseState.status = response.status
    responseState.statusText = response.statusText
    responseState.url =
      response.url || new URL(requestForm.path, window.location.href).toString()
    responseState.headers = Array.from(response.headers.entries())

    if (contentType.includes('image/') || contentType.includes('octet-stream')) {
      const buffer = new Uint8Array(await response.arrayBuffer())
      responseState.bodyKind = 'binary'
      responseState.body = previewBinary(buffer)
    } else {
      const rawBody = await response.text()

      if (contentType.includes('application/json')) {
        responseState.bodyKind = 'json'
        responseState.body = prettyJson(rawBody)
      } else if (contentType.includes('html')) {
        responseState.bodyKind = 'html'
        responseState.body = rawBody
      } else {
        responseState.bodyKind = 'text'
        responseState.body = rawBody
      }
    }

    lastRunLabel.value = `Completed in ${new Date().toLocaleTimeString()}`
  } catch (error) {
    responseState.error = error instanceof Error ? error.message : 'Request failed'
    responseState.status = 0
    responseState.statusText = ''
    responseState.url = ''
    responseState.body = ''
    responseState.bodyKind = 'text'
    responseState.headers = []
    lastRunLabel.value = 'Request failed'
  } finally {
    responseState.loading = false
  }
}

function methodTagType(method: RequestMethod): 'success' | 'warning' | 'danger' | 'info' {
  if (method === 'GET' || method === 'HEAD') {
    return 'success'
  }

  if (method === 'POST') {
    return 'warning'
  }

  if (method === 'DELETE') {
    return 'danger'
  }

  return 'info'
}

const endpointCount = endpointPresets.length
const App = defineComponent({
  name: 'App',
  setup() {
    applyPreset(endpointPresets[0]!)

    const currentRequestSummary = computed(
      () => `${requestForm.method} ${requestForm.path}`
    )
    const currentPreset = computed(() => {
      return endpointPresets.find((preset) => isActivePreset(preset)) ?? null
    })
    const responseHeaderSummary = computed(() => responseState.headers.length)

    return () =>
      h('div', { class: 'app-shell' }, [
        h('section', { class: 'hero' }, [
          h('div', { class: 'hero-top' }, [
            h('div', [
              h('div', { class: 'soft-chip soft-chip--accent' }, 'bun-httpbin'),
              h('h1', 'Request debugger with Vue3 + Element Plus'),
              h(
                'p',
                'A focused playground for testing httpbin-style endpoints, validating request metadata, and reading responses without leaving the browser.'
              )
            ]),
            h('div', { class: 'hero-badges' }, [
              h('span', { class: 'soft-chip' }, 'Bun HTML import'),
              h('span', { class: 'soft-chip' }, 'Vue 3'),
              h('span', { class: 'soft-chip' }, 'Element Plus')
            ])
          ]),
          h('div', { class: 'hero-grid' }, [
            h(
              ElCard,
              { class: 'metric-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'metric-label' }, 'Presets'),
                  h('div', { class: 'metric-value' }, String(endpointCount)),
                  h('div', { class: 'metric-note' }, 'Common request scenarios')
                ]
              }
            ),
            h(
              ElCard,
              { class: 'metric-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'metric-label' }, 'Methods'),
                  h('div', { class: 'metric-value' }, String(requestMethods.length)),
                  h('div', { class: 'metric-note' }, 'Supported in the composer')
                ]
              }
            ),
            h(
              ElCard,
              { class: 'metric-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'metric-label' }, 'Response headers'),
                  h('div', { class: 'metric-value' }, String(responseHeaderSummary.value)),
                  h('div', { class: 'metric-note' }, 'Updated after each run')
                ]
              }
            ),
            h(
              ElCard,
              { class: 'metric-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'metric-label' }, 'Status'),
                  h(
                    'div',
                    { class: 'metric-value' },
                    responseState.status ? String(responseState.status) : '--'
                  ),
                  h('div', { class: 'metric-note' }, lastRunLabel.value)
                ]
              }
            )
          ])
        ]),

        h('div', { class: 'main-grid' }, [
          h(
            ElCard,
            { class: 'panel', shadow: 'never' },
            {
              default: () => [
                h('div', { class: 'panel-title' }, [
                  h('div', [
                    h('h2', 'Endpoint presets'),
                    h('p', 'Tap any preset to prefill the request composer.')
                  ]),
                  h(ElTag, { effect: 'plain', type: 'success' }, () => 'same-origin')
                ]),
                h(
                  'div',
                  { class: 'endpoint-group-list' },
                  endpointPresetGroups.map((group) =>
                    h('section', { class: 'endpoint-group', key: group.title }, [
                      h('div', { class: 'endpoint-group-head' }, [
                        h('div', [
                          h('h3', { class: 'endpoint-group-title' }, group.title),
                          h('p', { class: 'endpoint-group-desc' }, group.description)
                        ]),
                        h(ElTag, { effect: 'plain', type: 'info' }, () => String(group.items.length))
                      ]),
                      h(
                        'div',
                        { class: 'endpoint-list' },
                        group.items.map((preset) =>
                          h(
                            ElButton,
                            {
                              key: `${preset.method}-${preset.path}`,
                              class: ['endpoint-button', { 'is-active': isActivePreset(preset) }],
                              link: true,
                              onClick: () => applyPreset(preset)
                            },
                            {
                              default: () => [
                                h(
                                  ElTag,
                                  {
                                    class: 'endpoint-method',
                                    effect: 'dark',
                                    type: methodTagType(preset.method)
                                  },
                                  () => preset.method
                                ),
                                h('div', { class: 'endpoint-copy' }, [
                                  h('div', { class: 'endpoint-path' }, preset.path),
                                  h('div', { class: 'endpoint-desc' }, preset.description)
                                ])
                              ]
                            }
                          )
                        )
                      )
                    ])
                  )
                )
              ]
            }
          ),

          h('div', { class: 'composer-grid' }, [
            h(
              ElCard,
              { class: 'composer-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'panel-title' }, [
                    h('div', [
                      h('h2', 'Request composer'),
                      h('p', 'Adjust method, headers, and payload before sending the request.')
                    ]),
                    h(ElTag, { effect: 'plain', type: 'warning' }, () => 'Bun.serve')
                  ]),

                  h('div', { class: 'request-meta' }, [
                    h('span', { class: 'request-summary request-summary--strong' }, currentRequestSummary.value),
                    h('span', { class: 'request-subtle' }, currentPreset.value?.title ?? 'Custom request')
                  ]),

                  h('div', { class: 'inline-form' }, [
                    h('div', { class: 'request-toolbar' }, [
                      h('div', { class: 'request-toolbar-row' }, [
                        h('div', [
                          h('div', { class: 'field-label' }, 'Method'),
                          h(
                            ElSelect,
                            {
                              modelValue: requestForm.method,
                              class: 'request-method',
                              'onUpdate:modelValue': (value: RequestMethod) => {
                                requestForm.method = value
                              }
                            },
                            () =>
                              requestMethods.map((method) =>
                                h(ElOption, { key: method, label: method, value: method })
                              )
                          )
                        ]),

                        h('div', { class: 'request-actions request-actions--compact' }, [
                          h(
                            ElButton,
                            {
                              loading: responseState.loading,
                              type: 'primary',
                              onClick: () => {
                                void executeRequest()
                              }
                            },
                            { default: () => 'Send request' }
                          ),
                          h(
                            ElTooltip,
                            { content: 'Reset to the first preset' },
                            {
                              default: () =>
                                h(
                                  ElButton,
                                  {
                                    plain: true,
                                    onClick: () => {
                                      applyPreset(endpointPresets[0]!)
                                      responseState.error = ''
                                    }
                                  },
                                  { default: () => 'Reset' }
                                )
                            }
                          )
                        ])
                      ]),

                      h('div', { class: 'request-path-row' }, [
                        h('div', { class: 'field-label' }, 'Path'),
                        h(ElInput, {
                          modelValue: requestForm.path,
                          class: 'request-path',
                          placeholder: '/get?hello=bun',
                          'onUpdate:modelValue': (value: string) => {
                            requestForm.path = value
                          }
                        })
                      ])
                    ]),

                    h('div', [
                      h('div', { class: 'field-label' }, 'Headers as JSON'),
                      h(ElInput, {
                        modelValue: requestForm.headersText,
                        placeholder: '{"accept":"application/json"}',
                        autosize: { minRows: 5, maxRows: 10 },
                        type: 'textarea',
                        'onUpdate:modelValue': (value: string) => {
                          requestForm.headersText = value
                        }
                      })
                    ]),

                    h('div', [
                      h('div', { class: 'field-label' }, 'Body'),
                      h(ElInput, {
                        modelValue: requestForm.bodyText,
                        placeholder: '{"runtime":"bun"}',
                        autosize: { minRows: 7, maxRows: 14 },
                        type: 'textarea',
                        'onUpdate:modelValue': (value: string) => {
                          requestForm.bodyText = value
                        }
                      })
                    ]),
                    h('div', [
                      h('div', { class: 'field-label' }, 'Headers as JSON'),
                      h(ElInput, {
                        modelValue: requestForm.headersText,
                        placeholder: '{"accept":"application/json"}',
                        autosize: { minRows: 5, maxRows: 10 },
                        type: 'textarea',
                        'onUpdate:modelValue': (value: string) => {
                          requestForm.headersText = value
                        }
                      })
                    ]),

                    h('div', [
                      h('div', { class: 'field-label' }, 'Body'),
                      h(ElInput, {
                        modelValue: requestForm.bodyText,
                        placeholder: '{"runtime":"bun"}',
                        autosize: { minRows: 7, maxRows: 14 },
                        type: 'textarea',
                        'onUpdate:modelValue': (value: string) => {
                          requestForm.bodyText = value
                        }
                      })
                    ])
                  ])
                ]
              }
            ),

            h(
              ElCard,
              { class: 'response-card', shadow: 'never' },
              {
                default: () => [
                  h('div', { class: 'panel-title' }, [
                    h('div', [
                      h('h2', 'Response inspector'),
                      h('p', 'Inspect the status, headers, and body returned by the server.')
                    ]),
                    h(
                      ElTag,
                      {
                        effect: 'plain',
                        type: responseState.status >= 400 ? 'danger' : 'success'
                      },
                      () => (responseState.status ? `${responseState.status}` : 'idle')
                    )
                  ]),

                  responseState.error
                    ? h(
                        ElAlert,
                        {
                          class: 'response-error',
                          closable: false,
                          showIcon: true,
                          title: 'Request failed',
                          type: 'error'
                        },
                        { default: () => responseState.error }
                      )
                    : null,

                  h('div', { class: 'response-meta' }, [
                    h('div', { class: 'response-status' }, [
                      h(
                        'div',
                        { class: 'response-status-code' },
                        responseState.status ? String(responseState.status) : '--'
                      ),
                      h(
                        ElTag,
                        {
                          effect: 'dark',
                          type: responseState.status >= 400 ? 'danger' : 'success'
                        },
                        () => responseState.statusText || 'Waiting for a request'
                      ),
                      responseState.bodyKind === 'binary'
                        ? h(ElTag, { effect: 'plain', type: 'warning' }, () => 'binary')
                        : h(ElTag, { effect: 'plain', type: 'info' }, () => responseState.bodyKind)
                    ]),
                    h('div', { class: 'response-url' }, responseState.url || 'No response yet')
                  ]),

                  h('div', { class: 'response-grid' }, [
                    h('div', [
                      h(ElDivider, { contentPosition: 'left' }, () => 'Headers'),
                      h('table', { class: 'response-table' }, [
                        h(
                          'tbody',
                          responseState.headers.length > 0
                            ? responseState.headers.map(([key, value]) =>
                                h('tr', { key }, [h('th', key), h('td', value)])
                              )
                            : [
                                h('tr', { key: 'empty' }, [
                                  h('td', { colspan: 2, class: 'helper-text' }, 'No headers yet')
                                ])
                              ]
                        )
                      ])
                    ]),

                    h('div', [
                      h(ElDivider, { contentPosition: 'left' }, () => 'Body'),
                      h(
                        ElScrollbar,
                        { height: '28rem' },
                        {
                          default: () =>
                            h(
                              'pre',
                              {
                                class: [
                                  'response-body',
                                  responseState.bodyKind === 'binary' ? 'response-body--binary' : ''
                                ]
                              },
                              responseState.body || 'Run a request to see the response body here.'
                            )
                        }
                      )
                    ])
                  ])
                ]
              }
            )
          ])
        ])
      ])
  }
})

createApp(App).use(ElementPlus).mount('#app')