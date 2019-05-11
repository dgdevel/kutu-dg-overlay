var cssUpdater = function() {
	$.ajax({
		type : 'get',
		url : 'main.styl?rnd=' + new Date().getTime(),
		complete : function(jqxhr, status) {
			var src = jqxhr.responseText;
			stylus.render(src, {}, function(err, css) {
				if (err) {
					console.error(err);
					throw err;
				}
				$('#stylesheet').text(css);
			});
		}
	});
};

if (config.reloadResourcesEvery > 0) {
	setInterval(cssUpdater, config.reloadResourcesEvery);
} else {
	setTimeout(cssUpdater, 100);
}