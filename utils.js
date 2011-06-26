(function() {
  var domToString, findHeader, htmlparser, http, https, parseHTML, request, runAll, sys, url;
  sys = require('sys');
  htmlparser = require('htmlparser');
  url = require('url');
  http = require('http');
  https = require('https');
  request = function(options, complete) {
    var finished, http_module, http_options, port, req, timeout, uri, _ref;
        if ((_ref = options.limit) != null) {
      _ref;
    } else {
      options.limit = 4;
    };
    if (options.limit === 0) {
      return complete("Too many redirects: " + options.uri);
    }
    uri = url.parse(options.uri);
    port = 80;
    http_module = http;
    if (uri.protocol === 'https:') {
      port = 443;
      http_module = https;
    }
    if (uri.port) {
      port = parseInt(uri.port);
    }
    http_options = {
      host: uri.hostname,
      port: port,
      path: uri.pathname + (uri.search || '')
    };
    http_options.headers = options.headers || {};
    http_options.headers['host'] = uri.hostname;
    req = http_module.get(http_options);
    req.on('error', function(err) {
      return complete(err + ": " + options.uri);
    });
    finished = false;
    timeout = options.timeout || 10000;
    setTimeout((function() {
      if (!finished) {
        complete("Request timed out after " + (timeout / 1000) + " seconds. (" + options.uri + ")");
        return complete = function() {};
      }
    }), timeout);
    return req.on('response', function(res) {
      var body, content_type, cookie, cookies;
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        options.limit -= 1;
        if (!(/^https?:/.test(res.headers.location))) {
          options.uri = url.resolve(uri.href, res.headers.location);
        } else {
          options.uri = res.headers.location;
        }
        options.headers = {};
        if (res.headers['set-cookie']) {
          cookies = (function() {
            var _i, _len, _ref2, _results;
            _ref2 = res.headers['set-cookie'];
            _results = [];
            for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
              cookie = _ref2[_i];
              _results.push(cookie.split(';')[0] + ';');
            }
            return _results;
          })();
          options.headers.cookie = cookies.join(' ');
        }
        finished = true;
        return request(options, complete);
      }
      if (res.statusCode >= 400) {
        return complete("Invalid page '" + options.uri + "' - " + res.statusCode);
      }
      content_type = findHeader(res.headers, 'content-type');
      if (content_type && content_type.indexOf('image') > -1) {
        finished = true;
        return complete("Bad mime type:" + content_type);
      }
      if (options.onFinalURI) {
        if (!options.onFinalURI(options.uri)) {
          finished = true;
          return;
        }
      }
      body = "";
      res.on('data', function(chunk) {
        return body += chunk;
      });
      return res.on('end', function() {
        finished = true;
        return complete(false, res, body, options.uri);
      });
    });
  };
  findHeader = function(headers, key) {
    var k, v;
    for (k in headers) {
      v = headers[k];
      if (key === k.toLowerCase()) {
        return v;
      }
    }
    return null;
  };
  runAll = function(callbacks, timeout, complete) {
    var callback, manager, totalLeft, _i, _len, _results;
    if (!complete) {
      complete = timeout;
      timeout = null;
    }
    if (callbacks.length === 0) {
      return complete();
    }
    totalLeft = callbacks.length;
    _results = [];
    for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
      callback = callbacks[_i];
      manager = {
        called: false,
        done: function() {
          this.called = true;
          if ((totalLeft -= 1) === 0) {
            return complete();
          }
        }
      };
      callback(manager);
      _results.push(timeout ? setTimeout((function() {
        if (!manager.called) {
          if (callback.onTimeout) {
            callback.onTimeout();
          }
          return manager.done();
        }
      }), timeout) : void 0);
    }
    return _results;
  };
  parseHTML = function(doc) {
    var handler, parser;
    handler = new htmlparser.DefaultHandler(function(error, dom) {});
    parser = new htmlparser.Parser(handler);
    parser.parseComplete(doc);
    return handler.dom;
  };
  domToString = function(dom) {
    var string;
    if (dom.type === 'text') {
      return dom.raw;
    }
    if (!dom.type === 'tag') {
      return '';
    }
    string = "<" + dom.raw + ">";
    (dom.children || []).forEach(function(child) {
      return string += domToString(child);
    });
    return string + ("</" + dom.name + ">");
  };
  String.prototype.reverse = function() {
    return this.split('').reverse().join('');
  };
  String.prototype.endsWith = function(s) {
    return this.reverse().indexOf(s.reverse()) === 0;
  };
  exports.runAll = runAll;
  exports.parseHTML = parseHTML;
  exports.domToString = domToString;
  exports.request = request;
}).call(this);
