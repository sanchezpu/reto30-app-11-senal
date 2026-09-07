// Copyright 2012 Google Inc. All rights reserved.
// Contenedor de ejemplo. Reproduce la forma real de un gtm.js publicado: las
// etiquetas viajan serializadas y el HTML personalizado va escapado, que es
// justo lo que hay que deshacer para ver el pixel pegado a mano dentro.

(function(w,g){w._CI=w._CI||[];})(window,document);

var data = {
  "resource": {
    "version": "42",
    "macros": [
      {"function":"__e"},
      {"function":"__v","vtp_name":"gtm.elementUrl","vtp_dataLayerVersion":1},
      {"function":"__v","vtp_dataLayerVersion":2,"vtp_setDefaultValue":false,"vtp_name":"ecommerce.value"},
      {"function":"__v","vtp_dataLayerVersion":2,"vtp_setDefaultValue":false,"vtp_name":"ecommerce.transaction_id"},
      {"function":"__c","vtp_value":"G-7QM4XKD2LP"}
    ],
    "tags": [
      {"function":"__googtag","once_per_event":true,"vtp_tagId":["macro",4],"tag_id":1},
      {"function":"__gaawe","once_per_event":true,"vtp_eventName":"view_item","vtp_measurementIdOverride":["macro",4],"tag_id":2},
      {"function":"__gaawe","once_per_event":true,"vtp_eventName":"add_to_cart","vtp_measurementIdOverride":["macro",4],"tag_id":3},
      {"function":"__gaawe","once_per_event":true,"vtp_eventName":"purchase","vtp_measurementIdOverride":["macro",4],"vtp_eventSettingsTable":[["value",["macro",2]],["transaction_id",["macro",3]]],"tag_id":4},
      {"function":"__awct","once_per_event":true,"vtp_conversionId":"11209384756","vtp_conversionLabel":"7hQjCLuk9pMZEPTf8N8p","vtp_enableConversionLinker":true,"tag_id":5},
      {"function":"__gclidw","once_per_event":true,"vtp_enableCrossDomain":false,"tag_id":6},
      {"function":"__html","once_per_event":true,"vtp_html":"<script type=\"text\/javascript\">\n  !function(f,b,e,v,n,t,s){}(window,document,'script','https:\/\/connect.facebook.net\/en_US\/fbevents.js');\n  fbq('init', '1042577819384210');\n  fbq('track', 'PageView');\n<\/script>","vtp_supportDocumentWrite":false,"tag_id":7},
      {"function":"__html","once_per_event":true,"vtp_html":"<script type=\"text\/javascript\">\n  !function (w, d, t) {w.TiktokAnalyticsObject=t;}(window, document, 'ttq');\n  ttq.load('CQ8F7JBC77U1A9K2M3RG');\n  ttq.page();\n<\/script>","vtp_supportDocumentWrite":false,"tag_id":8},
      {"function":"__html","once_per_event":true,"vtp_html":"<script type=\"text\/javascript\">\n  _linkedin_partner_id = \"5842097\";\n  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];\n  window._linkedin_data_partner_ids.push(_linkedin_partner_id);\n<\/script>\n<noscript><img height=\"1\" width=\"1\" style=\"display:none;\" alt=\"\" src=\"https:\/\/px.ads.linkedin.com\/collect\/?pid=5842097&fmt=gif\" \/><\/noscript>","vtp_supportDocumentWrite":false,"tag_id":9},
      {"function":"__cvt_8471029_12","once_per_event":true,"vtp_pixelId":"1042577819384210","vtp_eventName":"ViewContent","tag_id":10},
      {"function":"__cvt_8471029_13","once_per_event":true,"vtp_pixelId":"1042577819384210","vtp_eventName":"AddToCart","tag_id":11},
      {"function":"__img","once_per_event":true,"vtp_useCacheBuster":true,"vtp_url":"https:\/\/analytics.example-partner.com\/p.gif","tag_id":12}
    ],
    "predicates": [
      {"function":"_eq","arg0":["macro",0],"arg1":"gtm.js"},
      {"function":"_eq","arg0":["macro",0],"arg1":"view_item"},
      {"function":"_eq","arg0":["macro",0],"arg1":"add_to_cart"},
      {"function":"_eq","arg0":["macro",0],"arg1":"purchase"}
    ],
    "rules": [
      [["if",0],["add",0,6,7,8,9]],
      [["if",1],["add",1,10]],
      [["if",2],["add",2,11]],
      [["if",3],["add",3,4]]
    ]
  },
  "runtime": []
};

/*
 El resto del archivo es el intérprete del contenedor: unos cientos de
 kilobytes de código de Google que no aporta nada al análisis. Se recorta en
 este ejemplo para que el fichero siga siendo legible, pero la forma de los
 datos de arriba es la de un contenedor publicado de verdad.
*/
var b = function(a) { return a; };
var c = function(a, d) { return a === d; };
var e = function() { return data.resource.tags.length; };
window.google_tag_manager = window.google_tag_manager || {};
window.google_tag_manager['GTM-N8PZK4Q'] = { dataLayer: { get: b, set: c }, tagCount: e() };
