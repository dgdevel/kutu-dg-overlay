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

function fmtLapTime(time) {
	var min = parseInt(time / 60);
	var sec = parseInt(time) % 60;
	var dec = time % 1;
	if (min > 0) {
		return String(min).padStart(2,'0')+ ":" + String(sec).padStart(2,'0') + "." + dec.toFixed(3).substring(2);
	}
	return String(sec).padStart(2,'0') + "." + dec.toFixed(3).substring(2);
}

var ir = new IRacing(
	// refreshed every time
	[ 'DriverInfo'
	, 'SessionInfo'
	, 'SessionNum'
	, 'SessionTimeRemain'
	, 'CamCarIdx'
	, 'CarIdxLapCompleted'
	, 'CarIdxLapDistPct'
	, 'SessionTime'
	]
	// refreshed once
	, [ 'WeekendInfo'
	  ]
	// one refresh per second
	, 1);

var data = {
	config:config
	/*
	the data structure built by the updater
	
	event : {
		track : {
			name : string,
			layout : string,
			city : string,
			country : string,
			temp : string
		},
		air : {
			temp : string
		},
		type : string, // PRACTICE, QUALIFY, RACE
		status : {
			totalTime : number, // seconds
			remainingTime : number,
			totalLaps : number,
			completedLaps : number
		},
	},
	cars : [
		{
			type : string,
			className : string,
			driver : {
				name : string,
				license : string,
				iRating : number
			},
			team : {
				name : string
			}
		}
	],
	multiClass : boolean,
	standings : [
		{
			position : string,
			name : string,
			gap : string,
			best : string 
		}
	],
	current : number // index
	
	*/
};

ir.onConnect = () => { data = {config:config}; redraw(); };
ir.onDisconnect = () => { data = {config:config}; redraw(); };

ir.onUpdate = (keys) => {
	try {
		if (keys.indexOf('WeekendInfo') !== -1) {
			data.event = {
				track : {
					name : ir.data.WeekendInfo.TrackDisplayName,
					layout : ir.data.WeekendInfo.TrackConfigName,
					city : ir.data.WeekendInfo.TrackCity,
					country : ir.data.WeekendInfo.TrackCountry,
					temp : ir.data.WeekendInfo.TrackSurfaceTemp
				},
				air : {
					temp : ir.data.WeekendInfo.TrackAirTemp
				}
			};
		}
		if (keys.indexOf('DriverInfo') !== -1) {
			data.cars = ir.data.DriverInfo.Drivers.map((driver) => { return {
				type : driver.CarScreenName,
				className : driver.CarClassShortName,
				driver : {
					driver : driver.UserName,
					license : driver.LicString,
					iRating : driver.IRating
				},
				team : {
					name : driver.TeamName
				}
			}});
		}
		if (keys.indexOf('CamCarIdx') !== -1) {
			data.current = ir.data.CamCarIdx;
		}
		if (keys.indexOf('SessionNum') !== -1) {
			data._sessionNum = ir.data.SessionNum;
		}
		if (keys.indexOf('SessionInfo') !== -1) {
			data._sessions = ir.data.SessionInfo.Sessions.map((session) => { return {
				type : session.SessionName,
				lapsCompleted : session.ResultsLapsComplete,
				totalLaps : session.SessionLaps,
				timeLimit : session.SessionTime,
				ResultsPositions : session.ResultsPositions
			}});
		}
		if (keys.indexOf('SessionTime') !== -1) {
			data._sessionTime = ir.data.SessionTime;
		}
		if (keys.indexOf('CarIdxLapCompleted') !== -1) {
			data._lapsCompleted = ir.data.CarIdxLapCompleted;
		}
		if (keys.indexOf('CarIdxLapDistPct') !== -1) {
			data._currentLapDistanceCompleted = ir.data.CarIdxLapDistPct;
		}
		
		// complete missing data for rendering
		if (data.current && data.cars) {
			data.currentDriver = JSON.parse(JSON.stringify(data.cars[data.current]));
			if (data.currentDriver.team.name === data.currentDriver.driver.name) {
				data.currentDriver.team.name = null;
			}
		}
		if (data._sessionNum && data._sessions && data.event) {
			var session = data._sessions[data._sessionNum];
			data.event.type = session.type;
			data.event.status = {
				totalTime : session.timeLimit,
				remainingTime : data._sessionTime,
				totalLaps : session.totalLaps,
				completedLaps : session.lapsCompleted
			};
		}
		if (data._sessionNum && data._sessions && data.cars && data.event && data.event.status && data._currentLapDistanceCompleted) {
			var carClasses = data.cars.reduce((classes, car) => {
				if (car.className && classes.indexOf(car.className) === -1) {
					classes.push(car.className);
				}
				return classes;
			}, []);
			var session = data._sessions[data._sessionNum];
			data.multiClass = carClasses.length > 1;
			if (carClasses.length > 1) {
				data.standings = carClasses.map((carClass) => {
					var subList = [];
					if (session.ResultsPositions) {
						subList = session.ResultsPositions.
							filter((rp) => data.cars[rp.CarIdx].className === carClass).
							map((rp, index) => {
								var car = data.cars[rp.CarIdx];
								var best = null;
								if (data._currentLapDistanceCompleted[rp.CarIdx] < 0.5) {
									if (rp.LastTime === rp.FastestTime && rp.FastestLap !== -1 && rp.LastTime > 0) {
										best = fmtLapTime(rp.LastTime);
									}
								}
								return {
									position : String(rp.ClassPosition + 1).padStart(2, '0'),
									name : car.team.name ? car.team.name : car.driver.name,
									gap : fmtGap(data.event.status.completedLaps - rp.LapsComplete, rp.Time),
									best : best
								}
							}).
							slice(0, config.maxCars !== -1 ? config.maxCars : 255);
					}
					
					return {
						carClass : carClass,
						subStandings : subList
					};
				});
			} else {
				data.standings = session.ResultsPositions.map((rp, index) => {
					var car = data.cars[rp.CarIdx];
					var best = null;
					if (data._currentLapDistanceCompleted[rp.CarIdx] < 0.5) {
						if (rp.LastTime === rp.FastestTime && rp.FastestLap !== -1 && rp.LastTime > 0) {
							best = fmtLapTime(rp.LastTime);
						}
					}
					return {
						position : String(rp.ClassPosition + 1).padStart(2, '0'),
						name : car.team.name ? car.team.name : car.driver.name,
						gap : fmtGap(data.event.status.completedLaps - rp.LapsComplete, rp.Time),
						best : best
					}
				}).slice(0, config.maxCars !== -1 ? config.maxCars : 255);
			}
		}
		redraw();
	} catch (e) {
		console.error(e);
	}
};
