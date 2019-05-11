var template = function(){};

var templateUpdater = function() {
	$.ajax({
		type : 'get',
		url : 'main.html?rnd=' + new Date().getTime(),
		complete : function(jqxhr, status) {
			var src = jqxhr.responseText;
			template = Handlebars.compile(src);
		}
	});
};

if (config.reloadResourcesEvery > 0) {
	setInterval(templateUpdater, config.reloadResourcesEvery);
} else {
	setTimeout(templateUpdater, 100);
}

var doUpdate = true;
// doUpdate = false for debug in browser console

var redraw = function() {
	if (doUpdate) {
		$(document.body).html(template(data));
	}
};