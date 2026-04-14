import { describe, expect, test } from 'bun:test'

import { buildRequestContext } from '../src/http/request-context'

describe('request context parsing', () => {
  test('normalizes multipart file metadata and repeated form fields', async () => {
    const form = new FormData()
    form.append('tag', 'alpha')
    form.append('tag', 'beta')
    form.set(
      'upload',
      new File(['hello bun'], 'hello.txt', {
        type: 'text/plain; charset=utf-8'
      })
    )

    const request = new Request('http://example.test/upload?hello=world&hello=bun', {
      body: form,
      headers: {
        cookie: 'session=abc%20123; theme=dark',
        'user-agent': 'bun-test-suite',
        'x-forwarded-for': '198.51.100.10, 198.51.100.11'
      },
      method: 'POST'
    })

    const context = await buildRequestContext(request, {
      requestIP: () =>
        ({
          address: '203.0.113.42',
          family: 'IPv4',
          port: 0
        }) as Bun.SocketAddress
    })

    expect(context.method).toBe('POST')
    expect(context.path).toBe('/upload')
    expect(context.args).toEqual({ hello: ['world', 'bun'] })
    expect(context.cookies).toEqual({ session: 'abc 123', theme: 'dark' })
    expect(context.origin).toBe('198.51.100.10')
    expect(context.userAgent).toBe('bun-test-suite')
    expect(context.body.data).toBe('')
    expect(context.body.json).toBeNull()
    expect(context.body.form).toEqual({ tag: ['alpha', 'beta'] })
    expect(context.body.files).toEqual({
      upload: {
        name: 'hello.txt',
        size: 9,
        type: 'text/plain'
      }
    })
  })

  test('HEAD requests skip body parsing and fall back to x-real-ip', async () => {
    const request = new Request('http://example.test/head-check', {
      headers: {
        'user-agent': 'head-check',
        'x-real-ip': '192.0.2.77'
      },
      method: 'HEAD'
    })

    const context = await buildRequestContext(request, {
      requestIP: () => null
    })

    expect(context.body).toEqual({
      data: '',
      files: {},
      form: {},
      json: null
    })
    expect(context.origin).toBe('192.0.2.77')
  })
})