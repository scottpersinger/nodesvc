(function() {
  var formidable, http, jQueryPath, jsdom, open_options, path, phone_user_agent, port, report_error, router, sys, urlparse, user_agent, utils;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  utils = require('./utils');
  http = require('http');
  router = require('./lib/choreographer').router();
  sys = require('sys');
  jsdom = require('jsdom');
  jQueryPath = 'http://code.jquery.com/jquery-1.4.2.min.js';
  urlparse = require('url');
  formidable = require('formidable');
  path = require("path");
  user_agent = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_7; en-US) AppleWebKit/534.13 (KHTML, like Gecko) Chrome/9.0.597.102 Safari/534.13';
  phone_user_agent = 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_0 like Mac OS X; en-us) AppleWebKit/528.18 (KHTML, like Gecko) Version/4.0 Mobile/7A341 Safari/528.16';
  report_error = function(err, res) {
    sys.log('EXCEPTION: ' + sys.inspect(err));
    if (err.stack != null) {
      sys.log(err.stack);
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });
    res.write("Error: " + err.message);
    return res.end();
  };
  process.on('uncaughtException', function(err) {
    sys.log('FATAL EXCEPTION: ' + err);
    return sys.log(err.stack);
  });
  open_options = function(req, res) {
    var acheaders, acmethods;
    sys.log("Returning cross-domain header");
    acmethods = req.headers['Access-Control-Request-Method'] || req.headers['access-control-request-method'];
    acheaders = req.headers['Access-Control-Request-Headers'] || req.headers['access-control-request-headers'];
    sys.log(sys.inspect(req.headers));
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': acheaders,
      'Access-Control-Allow-Method': acmethods
    });
    return res.end();
  };
  router.options('/scrape', function(req, res) {
    return open_options(req, res);
  });
  router.options('/log', function(req, res) {
    return open_options(req, res);
  });
  router.get('/log', function(req, res) {
    var url;
    url = urlparse.parse(req.url, true);
    sys.log('==> ' + url.query['msg']);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': 'Access-Control-Allow-Origin',
      '*': '*'
    });
    return res.end();
  });
  router.get('/nothing', function(req, res) {
    res.writeHead(204, {});
    return res.end();
  });
  router.get('/', function(req, res) {
    sys.log("Request for home page");
    res.write("<html><body><h1>Scraper Test Page</h1>" + "<div style=\"float:left;width:520px\">" + "<form action=\"/scrape\" target=\"results\" method=\"POST\" onsubmit=\"document.getElementById('results').src = 'about:blank';\" enctype=\"multipart/form-data\">" + "url: <input type=\"text\" name=\"url\" value=\"http://google.com\" style=\"width:470px\" /><br />" + "<textarea name=\"body\" style=\"width:500px;height:400px\">return $('a').length</textarea><br />" + "User agent: <select name=\"agent\"><option>iPhone</option><option>Desktop</option></select><br />" + "<input type=\"submit\" value=\"Run\" />" + "</form>" + "</div>" + "<div style=\"float:left;width:400px\">" + "Results<br />" + "<iframe id=\"results\" name=\"results\" style=\"width:400px;height:400px\"></iframe>" + "</div>" + "</body></html>");
    return res.end();
  });
  router.post('/scrape', function(req, res) {
    var form;
    form = new formidable.IncomingForm();
    sys.log("Parsing form");
    return form.parse(req, function(err, fields, files) {
      var command_script, origin, theAgent, url;
      sys.log("Form parsing returned");
      sys.log(sys.inspect({
        fields: fields,
        files: files
      }));
      origin = req.headers['Origin'] || req.headers['origin'];
      res.setHeader('Access-Control-Allow-Origin', '*');
      theAgent = phone_user_agent;
      if (fields.agent === 'Desktop') {
        theAgent = user_agent;
      }
      url = fields.url;
      command_script = fields.body;
      sys.log("Request to scrape page: " + url);
      sys.log("And run script: " + command_script);
      if (!(url != null) || !(command_script != null)) {
        sys.log("Error url or body missing");
        res.writeHead(200, {
          'Content-Type': 'text/plain'
        });
        res.write("Error, no url parameter");
        return res.end();
      } else {
        return utils.request({
          uri: url,
          headers: {
            'user-agent': theAgent
          }
        }, __bind(function(err, response, body) {
          sys.log("page downloaded");
          if (!(body != null)) {
            sys.log("Body is empty, response: " + +sys.inspect(response));
            return report_error({
              message: "Page is empty. Maybe a bad url?"
            }, res);
          } else {
            try {
              return jsdom.env(body, [path.join(__dirname, 'lib', 'jquery-1.5.min.js')], function(errors, window) {
                var $, return_data;
                if (!(window.jQuery != null)) {
                  report_error({
                    message: "jQuery not loaded"
                  }, res);
                }
                $ = window.jQuery;
                sys.log("DOM created");
                sys.log("there are " + window.jQuery("a").length + " links found");
                eval("window.myinjecter = function() {" + command_script + "}");
                return_data = window.myinjecter();
                res.writeHead(200, {
                  'Content-Type': 'application/json; charset=utf-8'
                });
                res.write(JSON.stringify(return_data), "utf8");
                return res.end();
              });
            } catch (err) {
              return report_error(err, res);
            }
          }
        }, this));
      }
    });
  });
  port = process.argv[2] || 8080;
  http.createServer(router).listen(port);
  sys.debug("Server started on port " + port + ".");
  sys.log("Server started.");
}).call(this);
