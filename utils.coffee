sys = require('sys')
htmlparser = require('htmlparser')
url = require('url')
http = require('http')
https = require('https')

request = (options, complete) ->
  options.limit ?= 4
  
  if options.limit == 0
    return complete("Too many redirects: #{options.uri}")

  uri = url.parse(options.uri)
  port = 80
  http_module = http
  
  if uri.protocol == 'https:'
    port = 443
    http_module = https
  
  if uri.port
    port = parseInt(uri.port)
  
  http_options =
    host: uri.hostname
    port: port
    path: uri.pathname + (uri.search || '')
  
  http_options.headers = options.headers || {}
  http_options.headers['host'] = uri.hostname
  
  req = http_module.get(http_options)
  
  req.on 'error', (err) ->
    complete(err + ": " + options.uri)
  
  finished = false
  timeout = options.timeout || 10000
  setTimeout (->
    unless finished
      complete("Request timed out after #{timeout / 1000} seconds. (#{options.uri})")
      complete = ->
  ), timeout

  req.on 'response', (res) ->
    # Follow the redirect.
    if res.statusCode >= 300 && res.statusCode < 400 && res.headers.location
      options.limit -= 1
      
      if !(/^https?:/.test(res.headers.location))
        options.uri = url.resolve(uri.href, res.headers.location);
      else
        options.uri = res.headers.location
        
      options.headers = {}
      
      # Echo back every cookie (yfrog).
      if res.headers['set-cookie']
        cookies = (cookie.split(';')[0] + ';' for cookie in res.headers['set-cookie'])
        options.headers.cookie = cookies.join(' ')
      
      finished = true
      return request(options, complete)
    
    if res.statusCode >= 400
      return complete("Invalid page '#{options.uri}' - #{res.statusCode}")
      
    # Let's not worry about images.
    content_type = findHeader(res.headers, 'content-type')
    
    if content_type && content_type.indexOf('image') > -1
      finished = true
      return complete("Bad mime type:#{content_type}")
    
    if options.onFinalURI
      unless options.onFinalURI(options.uri)
        finished = true
        return
      
    body = ""
    
    res.on 'data', (chunk) ->
      body += chunk
    res.on 'end', ->
      finished = true
      complete(false, res, body, options.uri)

# The spec is case insensitive. Make key lowercase, please.
findHeader = (headers, key) ->
  for k, v of headers
    if key == k.toLowerCase()
      return v
  return null

runAll = (callbacks, timeout, complete) ->
  if !complete
    complete = timeout
    timeout = null

  if callbacks.length == 0
    return complete()

  totalLeft = callbacks.length
  
  for callback in callbacks
    manager =
      called: false
      done: ->
        this.called = true
        if (totalLeft -= 1) == 0
          complete()
    
    callback(manager)
    
    if timeout
      setTimeout (->
        if !manager.called
          if callback.onTimeout
            callback.onTimeout()
          manager.done()
        ), timeout

parseHTML = (doc) ->
  handler = new htmlparser.DefaultHandler (error, dom) ->
  parser = new htmlparser.Parser(handler)
  parser.parseComplete(doc)
  return handler.dom

domToString = (dom) ->
  if dom.type == 'text'
    return dom.raw

  # I'm not going to support scripts, comments, etc.
  if !dom.type == 'tag'
    return ''

  string = "<#{dom.raw}>"

  (dom.children || []).forEach (child) ->
    string += domToString(child)

  return string + "</#{dom.name}>"

# Monkey patches!
String.prototype.reverse = ->
  this.split('').reverse().join('')

String.prototype.endsWith = (s) ->
  this.reverse().indexOf(s.reverse()) == 0

exports.runAll = runAll
exports.parseHTML = parseHTML
exports.domToString = domToString
exports.request = request