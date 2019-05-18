var data = {
	config : config,
	event : {
		track : {
			name : 'track name',
			layout : 'layout',
			city : 'city',
			country : 'country',
			temp : '40 C'
		},
		air : {
			temp : '30 C'
		},
		type : 'RACE',
		status : {
			totalTime : 600,
			remainingTime : 342,
			totalLaps : undefined, // 30,
			completedLaps : 21
		}
	},
	multiClass : false,
	standings : [
		{
			position : '01',
			name : 'Sebastian Vettel',
			gap : '',
			best : '1:10.234'
		},
		{
			position : '02',
			name : 'Charles Leclerc',
			gap : '0.3'
		}
	],
	current : 0,
	currentDriver : {
		type : 'fiat 500',
		className : '500cc',
		driver : {
			name : 'Sebastian Vettel',
			license : 'A 2.23',
			iRating : 2335
		},
		team : {
			name : null
		}
	}
}