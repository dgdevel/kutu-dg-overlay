function fmtGap(lapsBehind, gap) {
	if (gap === 0) return "";
	gap = parseFloat(gap);
	var min = parseInt(gap / 60);
	var sec = parseInt(gap) % 60;
	var dec = gap % 1;
	var laps = "";
	if (lapsBehind > 0) {
		if (lapsBehind === 1) {
			laps = "1 lap + ";
		} else {
			laps = lapsBehind + " laps + ";
		}
	}
	return laps + (String(min).padStart(2, '0') + ":" + String(sec).padStart(2,'0') + '.' + dec.toFixed(1).substring(2));
}

var ir = new IRacing(
	// refreshed every time
	[ 'DriverInfo'
	, 'SessionInfo'
	, 'SessionNum'
	, 'SessionTimeRemain'
	, 'CamCarIdx'
	]
	// refreshed once
	, [ 'WeekendInfo'
	  ]
	// one refresh per second
	, 1);

var data = {config:config};

ir.onConnect = () => { data = {config:config}; redraw(); };
ir.onDisconnect = () => { data = {config:config}; redraw(); };

var onUpdate = (keys) => {
	// console.log(new Date(), 'onUpdate', keys);
	if (keys.indexOf('WeekendInfo') !== -1) {
		data.track = {
			name : ir.data.WeekendInfo.TrackDisplayName,
			layout : ir.data.WeekendInfo.TrackConfigName,
			shortName : ir.data.WeekendInfo.TrackName,
			city : ir.data.WeekendInfo.TrackCity,
			country : ir.data.WeekendInfo.TrackCountry
		};
	}
	if (keys.indexOf('DriverInfo') !== -1) {
		data.drivers = {};
		for (var i = 0; i < ir.data.DriverInfo.Drivers.length; i++) {
			var driver = ir.data.DriverInfo.Drivers[i];
			data.drivers[driver.CarIdx] = {
				car : driver.CarScreenName,
				driver : driver.UserName,
				license : driver.LicString,
				team : driver.TeamName,
				carClass : driver.CarClassShortName
			};
		}
		data.numberOfCarClass = ir.data.DriverInfo.Drivers
			.filter(function(d) {return !!d.CarClassShortName;})
			.map(function(d) { return d.CarClassShortName })
			.reduce(function(a,v) { if (a.indexOf(v) === -1) { a.push(v); } return a; }, [])
			.length;
	}
	if (keys.indexOf('CamCarIdx') !== -1) {
		data.car = {
			idx : ir.data.CamCarIdx,
			hasInfo : data.drivers && data.drivers[ir.data.CamCarIdx]
		};
		if (data.car.hasInfo) {
			data.driver = data.drivers[ir.data.CamCarIdx];
			data.driver.showTeam = data.driver.team !== data.driver.driver;
		}
	}
	if (keys.indexOf('SessionNum') !== -1) {
		if (data.sessions && data.sessions[ir.data.SessionNum]) {
			var session = data.sessions[ir.data.SessionNum];
			var status = null;
			if ('number' === typeof session.totalLaps && session.lapsCompleted >= 0) {
				if (session.lapsCompleted == session.totalLaps - 1) {
					status = "Last lap";
				} else {
					status = session.lapsCompleted + " / " + session.totalLaps + " laps";
				}
			} else {
				if (typeof session.timeLimit === 'undefined') {
					status = "";
				} else {
					totalMinutes = parseInt(session.timeLimit.match(/([0-9]+).[0-9]+ sec/)[1]) / 60;
					status = session.lapsCompleted + " laps / " + totalMinutes + " mins";
				}
			}
			data.session = {
				num : ir.data.SessionNum,
				type : data.sessions[ir.data.SessionNum].type,
				status : status
			};
			data.session.practice = data.session.type === 'PRACTICE';
			data.session.qualify = data.session.type === 'QUALIFY';
			data.session.race = data.session.type === 'RACE';
		}
		
	}
	if (keys.indexOf('SessionInfo') !== -1) {
		data.sessions = {};
		for (var i = 0; i < ir.data.SessionInfo.Sessions.length; i++) {
			var session = ir.data.SessionInfo.Sessions[i];
			data.sessions[session.SessionNum] = {
				type : session.SessionName,
				lapsCompleted : session.ResultsLapsComplete,
				totalLaps : session.SessionLaps,
				timeLimit : typeof session.SessionTime !== 'undefined' ? session.SessionTime : -1
			};
			if (data.drivers && data.session && data.session.num === session.SessionNum) {
				if (data.numberOfCarClass > 1) {
					data.standings = {
						carClasses : {}
					};
					for (var j = 0; j < ir.data.SessionInfo.Sessions[i].ResultsPositions.length ; j++) {
						var info = ir.data.SessionInfo.Sessions[i].ResultsPositions[j];
						var driver = data.drivers[info.CarIdx];
						if (!driver.carClass) {
							// pace car / safety car
							continue;
						}
						if (!data.standings.carClasses[driver.carClass]) {
							data.standings.carClasses[driver.carClass] = {
								name : driver.carClass,
								subStandings : []
							};
						}
						data.standings.carClasses[driver.carClass].subStandings.push({
							position : info.ClassPosition + 1,
							positionStr : String(info.ClassPosition + 1).padStart(2, "0"),
							driver : driver.driver,
							team : driver.team,
							gap : info.Time,
							lapsBehind : session.ResultsLapsComplete - info.LapsComplete,
							gapStr : fmtGap(session.ResultsLapsComplete - info.LapsComplete, info.Time)
						});
					}
					if (config.maxCars > 0) {
						for (var carClass in data.standings.carClasses) {
							if (config.maxCars < data.standings.carClasses[carClass].subStandings.length) {
								data.standings.carClasses[carClass].subStandings.splice(config.maxCars+1,
									data.standings.carClasses[carClass].subStandings.length - config.maxCars);
							}
						}
					}
				} else {
					data.standings = [];
					for (var j = 0; j < ir.data.SessionInfo.Sessions[i].ResultsPositions.length ; j++) {
						if (config.maxCars > 0 && data.standings.length > config.maxCars) {
							break;
						}
						var info = ir.data.SessionInfo.Sessions[i].ResultsPositions[j];
						data.standings.push({
							position : info.Position,
							positionStr : String(info.Position).padStart(2, "0"),
							driver : data.drivers[info.CarIdx].driver,
							gap : info.Time,
							lapsBehind : (session.ResultsLapsComplete - info.LapsComplete),
							gapStr : fmtGap(session.ResultsLapsComplete - info.LapsComplete, info.Time)
						});
					}
				}
			}
		}
		
	}
	redraw();
};

ir.onUpdate = (keys) => {
	try {
		onUpdate(keys);
	} catch (e) {
		console.error(e);
	}
};