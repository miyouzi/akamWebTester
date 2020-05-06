function start(){
	ping_regions(-1,0);
	$("#start").attr("disabled",true);
	$('#status').text('正在测试延迟，请等待');
	$('#loading').css('display', 'inline');
	$('#finished').css('display', 'none');
	$('#waiting').css('display', 'none');
}

var call_dns = function (key, node, link, json){
	for (var ip in json.ips){
		
		// 去重复 ip
		if (ip_list.indexOf(ip) === -1)  {
			var location = json.ips[ip].replace(/ .*$/, '');
			
			regions.push({text: location, code2: ip});
			ip_list.push(ip);
			
			let region_id = regions.length-1;
			let region = regions[region_id];
			
			var $tr = $("<tr>").addClass("region").attr("id", "region_" + region_id).append([ $("<td>").addClass("info region_ip"), $("<td>").addClass("info region_location"), $("<td>").addClass("stats region_mean"), $("<td>").addClass("stats region_median"), $("<td>").addClass("stats region_lowest"), $("<td>").addClass("stats region_highest")]);
			$tr.find("td.region_ip").html("<span>" + region.code2 + "</span>");
			$tr.find("td.region_location").html("<span>" + region.text + "</span>");
			$tr.find("td.stats").text("-");
			$("table").append($tr)
		}
		
	};
};

var complete_dns = function(){
	$("#start").attr("disabled",false);
	$('#status').text('IP解析完成，请进行第2步');
	$('#loading').css('display', 'none');
	$('#finished').css('display', 'none');
	$('#waiting').css('display', 'inline');
};

regions.forEach(function(region, region_id) {
	var $tr = $("<tr>").addClass("region").attr("id", "region_" + region_id).append([ $("<td>").addClass("info region_ip"), $("<td>").addClass("info region_location"), $("<td>").addClass("stats region_mean"), $("<td>").addClass("stats region_median"), $("<td>").addClass("stats region_lowest"), $("<td>").addClass("stats region_highest")]);
	$tr.find("td.region_ip").html("<span>" + region.code2 + "</span>");
	$tr.find("td.region_location").html("<span>" + region.text + "</span>");
	var url = download(region_id);if(url.length<1){var download_html="";} else {var download_html="<a href='"+download(region_id)+"' target='_blank'>点击前往</a>";}
	$tr.find("td.region_download").html(download_html);
	$tr.find("td.stats").text("-");
	$("table").append($tr)
});

function ping_region(region_id, callback) {
	var startTime = Date.now();
	var ws = new WebSocket(src(region_id));
	ws.onerror = function() {
		var endTime = Date.now();
		var timeElapsed = endTime - startTime;
		if (undefined !== callback) {
			callback(timeElapsed)
		}
	};
}

function ping_regions(iteration_id, region_id) {
	ping_region(region_id,
	function(timeElapsed) {
		if (0 === region_id) {
			var $th = $("<th>").addClass("test test_" + iteration_id).text("测试 " + (iteration_id + 1));
			var $td = $("<td>").addClass("test test_" + iteration_id).text("-");
			$("table").find("tr.heading").append($th);
			$("table").find("tr.region").append($td)
		}
		var $tr = $("table").find("tr.region#region_" + region_id);
		var $td = $tr.find("td.test.test_" + iteration_id);
		if (timeElapsed > 0) {
			$td.text(timeElapsed);
			$td.data("latency", timeElapsed)
		} else {
			$td.text("FAILED");
			$td.data("latency", 0)
		}
		var values = [];
		$tr.find("td.test").each(function() {
			var value = $(this).data("latency");
			if (value > 0) {
				values.push(value)
			}
		});
		$tr.find("td.region_mean").data("latency", stats.mean(values));
		$tr.find("td.region_mean").html("<span>" + stats.mean(values).toFixed(0) + "</span>");
		$tr.find("td.region_median").data("latency", stats.median(values));
		$tr.find("td.region_median").html("<b>" + stats.median(values).toFixed(0) + "</b>");
		$tr.find("td.region_lowest").data("latency", stats.lowest(values));
		$tr.find("td.region_lowest").html("<b>" + stats.lowest(values).toFixed(0) + "</b>");
		$tr.find("td.region_highest").data("latency", stats.highest(values));
		$tr.find("td.region_highest").html("<b>" + stats.highest(values).toFixed(0) + "</b>");
		highlight_stats(["region_mean", "region_median", "region_lowest", "region_highest", "test_" + iteration_id]);
		region_id++;
		if (region_id === regions.length) {
			region_id = 0;
			if (iteration_id < 0) {
				$("table").find(".test").filter("td,th").remove()
			} else {
				highlight_stats(["test_" + iteration_id])
			}
			iteration_id++
		}
		// 限制测试数量
		if (iteration_id === 3) {
			window.stop_that = true;
			sort();
			$('#status').text('延迟测试完成');
			$('#loading').css('display', 'none');
			$('#finished').css('display', 'inline');
			$('#waiting').css('display', 'none');
		}
		if (true !== window.stop_that || region_id !== 0) {
			ping_regions(iteration_id, region_id)
		}
	});
}

function highlight_stats(arr) {
	arr.forEach(function(column) {
		var $rows = $("table").find("td." + column);
		$rows = $rows.filter(function() {
			return (undefined !== $(this).data("latency"))
		});
		$rows.sort(function(a, b) {
			if ($(a).data("latency") < $(b).data("latency")) {
				return - 1
			} else {
				if ($(a).data("latency") > $(b).data("latency")) {
					return 1
				} else {
					return 0
				}
			}
		});
		var least_latency = $rows.first().data("latency");
		var most_latency = $rows.last().data("latency");
		var diff_latency = most_latency - least_latency;
		$rows.each(function() {
			var latency = $(this).data("latency");
			$(this).css("background-color", "hsl(" + ((most_latency - latency) * 135 / diff_latency) + ", 100%, 50%)")
		})
	})
}

var stats = {
	mean: function(values) {
		var sum = 0;
		values.forEach(function(value) {
			sum = sum + value
		});
		return sum / values.length
	},
	median: function(values) {
		values.sort(function(a, b) {
			return a - b
		});
		var half = Math.floor(values.length / 2);
		if (values.length % 2) {
			return values[half]
		} else {
			return (values[half - 1] + values[half]) / 2
		}
	},
	lowest: function(values) {
		return Math.min.apply(null, values)
	},
	highest: function(values) {
		return Math.max.apply(null, values)
	}
};
