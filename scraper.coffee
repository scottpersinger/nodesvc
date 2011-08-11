# node.js and jQuery based page scraper
#
# POST to /scrape with parameter url=<page url> and a chunk of Jquery-based javascript
# as the POST content. We will load the page at that URL, create a DOM using jsdom
# from the page, load jQuery into it, then execute the command script.
# The result of the script will be converted to JSON and returned.

utils = require('./utils')
http = require('http')
router = require('./lib/choreographer').router()
sys = require('sys')
jsdom = require('jsdom');
jQueryPath = 'http://code.jquery.com/jquery-1.4.2.min.js';
urlparse = require('url');
formidable = require('formidable');
path = require("path");

user_agent = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_7; en-US) AppleWebKit/534.13 (KHTML, like Gecko) Chrome/9.0.597.102 Safari/534.13'
phone_user_agent = 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_0 like Mac OS X; en-us) AppleWebKit/528.18 (KHTML, like Gecko) Version/4.0 Mobile/7A341 Safari/528.16';

report_error = (err, res) ->
  sys.log('EXCEPTION: ' + sys.inspect(err))
  sys.log(err.stack) if err.stack?
  res.writeHead(200, {'Content-Type': 'text/plain'});  
  res.write("Error: " + err.message);
  res.end();

process.on 'uncaughtException', (err) ->
  sys.log('FATAL EXCEPTION: ' + err)
  sys.log(err.stack)

open_options = (req, res) ->
  sys.log("Returning cross-domain header");
  acmethods = req.headers['Access-Control-Request-Method'] || req.headers['access-control-request-method'];
  acheaders = req.headers['Access-Control-Request-Headers'] || req.headers['access-control-request-headers'];
  sys.log(sys.inspect(req.headers));
  res.writeHead(200, {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers':acheaders, 'Access-Control-Allow-Method':acmethods});
  res.end();

router.options '/scrape', (req, res) ->
  open_options(req, res)
  
router.options '/log', (req, res) ->
  open_options(req, res)

router.get '/log', (req, res) ->
  url = urlparse.parse(req.url, true)
  sys.log('==> ' + url.query['msg'])
  res.writeHead(200, {'Access-Control-Allow-Origin', '*'});
  res.end()
  
router.get '/nothing', (req, res) ->
  res.writeHead(204, {})
  res.end()

router.get '/', (req, res) ->
  sys.log("Request for home page");
#  for k, v of req
#    sys.log("#{k} = #{v}");
  
  res.write("<html><body><h1>Scraper Test Page</h1>" + 
  "<div style=\"float:left;width:520px\">" +
    "<form action=\"/scrape\" target=\"results\" method=\"POST\" onsubmit=\"document.getElementById('results').src = 'about:blank';\" enctype=\"multipart/form-data\">" +
      "url: <input type=\"text\" name=\"url\" value=\"http://google.com\" style=\"width:470px\" /><br />" +
      "<textarea name=\"body\" style=\"width:500px;height:400px\">return $('a').length</textarea><br />" +
      "User agent: <select name=\"agent\"><option>iPhone</option><option>Desktop</option></select><br />" +
      "<input type=\"submit\" value=\"Run\" />" +
      "</form>" +
      "<br /><h2>Scratchpad</h2><br />" +
      "<textarea style=\"width:500px;height:300px\"></textarea>" +
    "</div>" +
    "<div style=\"float:left;width:400px\">" +
       "Results<br />" +
       "<iframe id=\"results\" name=\"results\" style=\"width:400px;height:400px\"></iframe>" +
    "</div>" +
    "</body></html>")
  res.end();

router.get '/proxy', (req,res) ->
     
router.post '/scrape', (req, res) ->  
  form = new formidable.IncomingForm();
    
  sys.log("Parsing form")
  
  form.parse req, (err, fields, files) -> 
    sys.log("Form parsing returned");
    sys.log(sys.inspect({fields: fields, files: files}));

    origin = req.headers['Origin'] || req.headers['origin'];
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    theAgent = phone_user_agent;
    if fields.agent == 'Desktop'
      theAgent = user_agent
      
    url = fields.url
    command_script = fields.body
    sys.log("Request to scrape page: #{url}");
    sys.log("And run script: " + command_script);
    if !url? || !command_script?
      sys.log("Error url or body missing");
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write("Error, no url parameter");
      res.end();
    else
      utils.request {uri: url, headers: {'user-agent': theAgent}}, (err, response, body) =>
        sys.log("page downloaded");
        if !body?
          sys.log("Body is empty, response: " +  + sys.inspect(response));
          report_error {message:"Page is empty. Maybe a bad url?"}, res
        else
          # setup dom and load jQuery
          try
            jsdom.env body, [path.join(__dirname, 'lib', 'jquery-1.5.min.js')], (errors, window) ->
                if !window.jQuery?
                  report_error {message:"jQuery not loaded"}, res
                $ = window.jQuery;
                sys.log("DOM created")
                sys.log("there are " + window.jQuery("a").length + " links found");
                eval("window.myinjecter = function() {#{command_script}}");
                return_data = window.myinjecter();
                #sys.log("Result of script is " + sys.inspect(return_data));
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});  
                res.write(JSON.stringify(return_data), "utf8");  
                res.end();
          catch err
            report_error(err, res)

port = process.argv[2] || 8080;
http.createServer(router).listen(port);
sys.debug("Server started on port " + port + ".")
sys.log("Server started.")
