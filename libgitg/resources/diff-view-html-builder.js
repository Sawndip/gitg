function html_escape(s)
{
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function diff_file(file, lnstate, data)
{
	tabrepl = '<span class="tab" style="width: ' + data.settings.tab_width + 'ex">\t</span>';

	var added = 0;
	var removed = 0;

	var file_body = '';

	for (var i = 0; i < file.hunks.length; ++i)
	{
		var h = file.hunks[i];

		if (!h)
		{
			file_body += '<tr class="context">\
				<td class="gutter old">' + lnstate.gutterdots + '</td>\
				<td class="gutter new">' + lnstate.gutterdots + '</td>\
				<td></td>\
			</tr>';
			continue;
		}

		var cold = h.range.old.start;
		var cnew = h.range.new.start;

		var hunk_header = '<span class="hunk_stats">@@ -' + h.range.old.start + ',' + h.range.old.lines + ' +' + h.range.new.start + ',' + h.range.new.lines + ' @@</span>';

		hunk_header = hunk_header;

		file_body += '<tr class="hunk_header">\
			<td class="gutter old">' + lnstate.gutterdots + '</td> \
			<td class="gutter new">' + lnstate.gutterdots + '</td> \
			<td class="hunk_header">' + hunk_header + '</td> \
		</tr>';

		for (var j = 0; j < h.lines.length; ++j)
		{
			var l = h.lines[j];
			var o = String.fromCharCode(l.type);

			var row = '<tr class="';

			switch (o)
			{
				case ' ':
					row += 'context"> \
						<td class="gutter old">' + cold + '</td> \
						<td class="gutter new">' + cnew + '</td>';

					cold++;
					cnew++;
				break;
				case '+':
					row += 'added"> \
						<td class="gutter old"></td> \
						<td class="gutter new">' + cnew + '</td>';

					cnew++;
					added++;
				break;
				case '-':
					row += 'removed"> \
						<td class="gutter old">' + cold + '</td> \
						<td class="gutter new"></td>';

					cold++;
					removed++;
				break;
				case '=':
				case '>':
				case '<':
					row += 'context"> \
						<td class="gutter old"></td> \
						<td class="gutter new"></td>';
						l.content = l.content.substr(1, l.content.length);
				break;
				default:
					row += '">';
				break;
			}

			row += '<td class="code">' + html_escape(l.content).replace(/\t/g, tabrepl) + '</td>';

			row += '</tr>';

			file_body += row;

			lnstate.processed++;

			proc = lnstate.processed / lnstate.lines;

			if (proc >= lnstate.nexttick)
			{
				self.postMessage({tick: proc});

				while (proc >= lnstate.nexttick)
				{
					lnstate.nexttick += lnstate.tickfreq;
				}
			}
		}
	}

	var file_path = '';
	var file_stats = '';
	var file_classes = '';

	if (file.file)
	{
		if (file.file.new.path)
		{
			file_path = file.file.new.path;
		}
		else
		{
			file_path = file.file.old.path;
		}

		var total = added + removed;
		var addedp = Math.floor(added / total * 100);
		var removedp = 100 - addedp;

		file_stats = '<span class="file_stats"><span class="number">' + (added + removed)  + '</span><span class="bar"><span class="added" style="width: ' + addedp + '%;"></span><span class="removed" style="width: ' + removedp + '%;"></span></span></span>';
	}
	else
	{
		file_classes = 'background';
	}

	var template = data.file_template;
	var repls = {
		'FILE_PATH': file_path,
		'FILE_BODY': file_body,
		'FILE_STATS': file_stats,
		'FILE_STAGE': lnstate.stagebutton,
		'FILE_CLASSES': file_classes
	};

	for (var r in repls)
	{
		// As we are using the repl in the later 'template.replace()'
		// as the replacement in which character '$' is special, we
		// need to make sure each occurence of '$' character in the
		// replacement is represented as '$$' (which stands for a
		// literal '$'), so, we need to use '$$$$' here to get '$$'.
		var repl = repls[r].replace(/\$/g, '$$$$');
		template = template.replace(lnstate.replacements[r], repl);
	}

	return template;
}

function diff_files(files, lines, maxlines, data)
{
	var f = '';

	var repl = [
		'FILE_PATH',
		'FILE_BODY',
		'FILE_STATS',
		'FILE_STAGE'
		'FILE_CLASSES'
	];

	var replacements = {};

	for (var r in repl)
	{
		replacements[repl[r]] = new RegExp('<!-- \\$\\{' + repl[r] + '\\} -->', 'g');
	}

	var lnstate = {
		lines: lines,
		maxlines: maxlines,
		gutterdots: new Array(maxlines.toString().length + 1).join('.'),
		processed: 0,
		nexttick: 0,
		tickfreq: 0.01,
		stagebutton: '',
		replacements: replacements,
	};

	if (data.settings.staged || data.settings.unstaged)
	{
		var cls;
		var nm;

		if (data.settings.staged)
		{
			cls = 'unstage';
			nm = data.settings.strings.unstage;
		}
		else
		{
			cls = 'stage';
			nm = data.settings.strings.stage;
		}

		lnstate.stagebutton = '<span class="' + cls + '">' + nm + '</span>';
	}
	// special empty background filler
	f += diff_file({hunks: [null]}, lnstate, data);

	for (var i = 0; i < files.length; ++i)
	{
		f += diff_file(files[i], lnstate, data);
	}

	return f;
}

function log(e)
{
	self.postMessage({'log': e});
}

self.onmessage = function(event) {
	var data = event.data;

	// Make request to get the diff formatted in json
	var r = new XMLHttpRequest();

	r.onload = function(e) {
		var j = JSON.parse(r.responseText);
		var html = diff_files(j.diff, j.lines, j.maxlines, data);

		self.postMessage({url: data.url, diff_html: html});
	}

	r.open("GET", data.url);
	r.send();
};
