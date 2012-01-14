window.app = function() {
	function loadCachedPage (url) {
		// Hide the iframe until the stylesheets are loaded,
		// to avoid flash of unstyled text.
		// Instead we're hidden, which also sucks.
		var replaceRes = function() {

			// images
			$('#main img').each(function() {
				var em = $(this);
				var gotLinkPath = function(linkPath) {
					em.attr('src', 'file://' + linkPath.file);
				}
				var target = this.src.replace('file:', 'https:');
				window.plugins.urlCache.getCachedPathForURI(target, gotLinkPath, gotError);
			});
		};
		var gotPath = function(cachedPage) {
			loadPage('file://' + cachedPage.file, url, function() {
				replaceRes();
			});
		}
		var gotError = function(error) {
			console.log('Error: ' + error);
			chrome.hideSpinner();
			// noConnectionMsg();
			// navigator.app.exitApp();
		}
		window.plugins.urlCache.getCachedPathForURI(url, gotPath, gotError);
	}

	function loadPage(url, origUrl, callback) {
		origUrl = origUrl || url;
		console.log('hideAndLoad url ' + url);
		console.log('hideAndLoad origUrl ' + origUrl);
		network.makeRequest({
			url: url, 
			success: function(data) {
					renderHtml(data, origUrl);
					if(callback) {
						callback();
					}
					onPageLoaded();
				},
			error: function(xhr) {
				if(xhr.status == 404) {
					loadLocalPage('404.html');
				} else {
					loadLocalPage('error.html');
				}
				languageLinks.clearLanguages();
				$('#savePageCmd').attr('disabled', 'true');
				console.log('disabling language');
				$('#languageCmd').attr('disabled', 'true');
			}
		});
	}

	function loadLocalPage(page) {
		$('base').attr('href', 'file:///android_asset/www/');
		$('#main').load(page, function() {
			$('#main').localize();
			onPageLoaded();
		});
	}

	function adjustFontSize(size) {
		var frameDoc = $("#main");
		$('#main').css('font-size', fontOptions[size]);
	}
	
	/**
	 * Import page components from HTML string and display them in #main
	 *
	 * @param string html
	 * @param string url - base URL
	 */
	function renderHtml(html, url) {
		$('base').attr('href', url);

		// Horrible hack to grab the lang & dir attributes from
		// the target page's <html> without parsing the rest
		var stub = html.match(/<html ([^>]+)>/i, '$1')[1],
			$stubdiv = $('<div ' + stub + '></div>'),
			lang = $stubdiv.attr('lang'),
			dir = $stubdiv.attr('dir');

		var trimmed = html.replace(/<body[^>]+>(.*)<\/body/i, '$1');

		var selectors = ['#content>*', '#copyright'],
			$target = $('#main'),
			$div = $('<div>').html(trimmed);

		$target
			.empty()
			.attr('lang', lang)
			.attr('dir', dir);
		$.each(selectors, function(i, sel) {
			$div.find(sel).remove().appendTo($target);
		});

		languageLinks.parseAvailableLanguages($div);
	}
	
	function initLinkHandlers() {
		adjustFontSize(preferencesDB.get('fontSize'));
		$('#main').delegate('a', 'click', function(event) {
			var target = this,
				url = target.href,             // expanded from relative links for us
				href = $(target).attr('href'); // unexpanded, may be relative

			// Stop the link from opening in the iframe directly...
			event.preventDefault();
			
			if (href.substr(0, 1) == '#') {
				// A local hashlink; simulate?
				var off = $(href).offset(),
					y = off ? off.top : 52;
				window.scrollTo(0, y - 52);
				return;
			}

			if (url.match(/^https?:\/\/([^\/]+)\.wikipedia\.org\/wiki\//)) {
				// ...and load it through our intermediate cache layer.
				navigateToPage(url);
			} else {
				// ...and open it in parent context for reals.
				//
				// This seems to successfully launch the native browser, and works
				// both with the stock browser and Firefox as user's default browser
				document.location = url;
			}
		});
	}
	
	function onPageLoaded() {
		window.scroll(0,0);
		addCurrentPageToHistory();
		toggleForward();
		updateMenuState(chrome.menu_handlers);
		$('#search').removeClass('inProgress');        
		chrome.hideSpinner();  
		console.log('currentHistoryIndex '+currentHistoryIndex + ' history length '+pageHistory.length);
	}

	function navigateToPage(url, options) {
		var options = $.extend({cache: false, updateHistory: true}, options || {});
		$('#searchParam').val('');
		$('#search').addClass('inProgress');
		chrome.showSpinner();
		
		if (options.cache) {
			loadCachedPage(url);
		} else {
			loadPage(url);
		}
		if (options.updateHistory) {
			currentHistoryIndex += 1;
			pageHistory[currentHistoryIndex] = url;
			// We're adding an entry to the 'forward/backwards' chain.
			// So disable forward.
		} 
		console.log("navigating to " + url);
		var savedPagesDB = new Lawnchair({name: "savedPagesDB"}, function() {
			this.exists(url, function(exists) {
				if(!exists) {
					$("#savePageCmd").attr("disabled", "false");
				} else {
					$("#savePageCmd").attr("disabled", "true");
				}
			});
		});
		// Enable change language - might've been disabled in a prior error page
		console.log('enabling language');
		$('#languageCmd').attr('disabled', 'false');  
	}

	function getCurrentUrl() {
		return pageHistory[currentHistoryIndex];
	}

	function getCurrentTitle() {
		var url = getCurrentUrl(),
			page = url.replace(/^https?:\/\/[^\/]+\/wiki\//, ''),
			unescaped = decodeURIComponent(page),
			title = unescaped.replace(/_/g, ' ');
		return title;
	}

	var exports = {
		adjustFontSize: adjustFontSize,
		navigateToPage: navigateToPage,
		initLinkHandlers: initLinkHandlers,
		getCurrentUrl: getCurrentUrl,
		getCurrentTitle: getCurrentTitle
	};

	return exports;
}();
