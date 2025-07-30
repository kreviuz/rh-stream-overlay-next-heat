/* Common data and functions for overlays */
var request_time;
var request_pi_time;
var resume_check = true;

function speak(obj, priority) {} // stub to prevent crashing

/* default handlers for RotorHazard events */
// NOTE: 'race_kickoff' must be defined locally in the HTML
default_handler = {
    'language': function (msg) {
        if (msg.language) {
            rotorhazard.interface_language = msg.language;
        }
    },
    
    'race_scheduled': function (msg) {
        if (msg.scheduled) {
            var deferred_start = msg.scheduled_at * 1000;  // convert seconds (pi) to millis (JS)
            rotorhazard.timer.deferred.start(deferred_start, null);
        } else {
            rotorhazard.timer.deferred.stop();
        }
    },
    
    'race_status': function (msg) {
        switch (msg.race_status) {
            case 1: // Race running
                rotorhazard.race_status_go_time = window.performance.now();
                $('body').addClass('race-running');
                $('body').removeClass('race-stopped');
                $('body').removeClass('race-new');
                $('.timing-clock').removeClass('staging');
                if (resume_check) {
                    race_kickoff(msg);
                }
                break;
            case 2: // Race stopped, clear or save laps
                $('body').removeClass('race-running');
                $('body').addClass('race-stopped');
                $('body').removeClass('race-new');
                $('.timing-clock').removeClass('staging');
                break;
            case 3: // Staging
                $('body').removeClass('race-stopped');
                $('body').addClass('race-running');
                $('body').removeClass('race-new');
                $('.timing-clock').addClass('staging');
                if (resume_check) {
                    race_kickoff(msg);
                }
                break;
            default: // Waiting to start new race
                $('body').removeClass('race-running');
                $('body').removeClass('race-stopped');
                $('body').addClass('race-new');
                $('.timing-clock').removeClass('staging');
                if (resume_check) {
                    socket.emit('get_race_scheduled');
                }
                break;
        }

        resume_check = false;
    },
    
    'heartbeat': function (msg) {
    },
    
    'prestage_ready': function (msg) {
        request_time = new Date();
    },
    
    'stage_ready': function (msg) {
        //race_kickoff(msg);
    },
    
    'stop_timer': function (msg) {
        rotorhazard.timer.stopAll();
    },
    
    'pi_time': function (msg) {
        var response_time = window.performance.now();
        var server_delay = response_time - rotorhazard.pi_time_request;
        var server_oneway = server_delay ? server_delay / 2 : server_delay;

        var server_time_differential = {
            'differential': (msg.pi_time_s * 1000) - response_time - server_oneway, // convert seconds (pi) to millis (JS)
            'response': parseFloat(server_delay)
        }

        // store sync sample
        rotorhazard.server_time_differential_samples.push(server_time_differential);

        // sort stored samples
        rotorhazard.server_time_differential_samples.sort(function(a, b) {
            return a.response - b.response;
        })

        // remove unusable samples
        var diff_min = rotorhazard.server_time_differential_samples[0].differential - rotorhazard.server_time_differential_samples[0].response
        var diff_max = rotorhazard.server_time_differential_samples[0].differential + rotorhazard.server_time_differential_samples[0].response

        rotorhazard.server_time_differential_samples = rotorhazard.server_time_differential_samples.filter(function(value, index, array) {
            return value.differential >= diff_min && value.differential <= diff_max;
        });

        // get filtered value
        var a = [];
        for (var i in rotorhazard.server_time_differential_samples) {
            a.push(rotorhazard.server_time_differential_samples[i].differential);
        }
        rotorhazard.server_time_differential = median(a);

        // pass current sync to timers
        rotorhazard.timer.race.sync();
        rotorhazard.timer.deferred.sync();

        // continue sampling for sync to improve accuracy
        if (rotorhazard.server_time_differential_samples.length < 10) {
            setTimeout(function() {
                rotorhazard.pi_time_request = window.performance.now();
                socket.emit('get_pi_time');
            }, (Math.random() * 500) + 250); // 0.25 to 0.75s delay
        }

        // update server info
        var a = Infinity;
        for (var i in rotorhazard.server_time_differential_samples) {
            a = Math.min(a, rotorhazard.server_time_differential_samples[i].response);
        }
        rotorhazard.sync_within = Math.ceil(a);
        //$('#server-lag').html('<p>Sync quality: within ' + a + 'ms (' + rotorhazard.server_time_differential_samples.length + ' samples)</p>');
    },
};

/* HTML generators for brackets */
class BracketHeat {
    constructor(number, type, column, advance_to) {
        this.number = number;          /* heat number, starting from 1 */
        this.type = type;              /* 'winner' or 'loser' */
        this.column = column;          /* column index where the heat shall be rendered, starting from 0 */
        this.advance_to = advance_to;  /* the next heat where the winners of this heat will race
                                        * applicable only if the first and the second classified advance to the same heat */
    }
}

const bracket_formats = {
    "multigp16": [
                   new BracketHeat(1,  "preliminary", 0, 6),
                   new BracketHeat(2,  "preliminary", 0, 6),
                   new BracketHeat(3,  "preliminary", 0, 8),
                   new BracketHeat(4,  "preliminary", 0, 8),
                   new BracketHeat(5,  "loser",       0, 9),
                   new BracketHeat(6,  "winner",      1, 11),
                   new BracketHeat(7,  "loser",       0, 10),
                   new BracketHeat(8,  "winner",      1, 11),
                   new BracketHeat(9,  "loser",       1, 12),
                   new BracketHeat(10, "loser",       1, 12),
                   new BracketHeat(11, "winner",      2, 14),
                   new BracketHeat(12, "loser",       2, 13),
                   new BracketHeat(13, "loser",       3, 14),
                   new BracketHeat(14, "winner",      3),
                 ],
    //"fai16":     [],
    //"fai16de":   [],
    //"fai32":     [],
    "fai32de":   [
                   new BracketHeat(1,  "preliminary", 0),
                   new BracketHeat(2,  "preliminary", 0),
                   new BracketHeat(3,  "preliminary", 0),
                   new BracketHeat(4,  "preliminary", 0),
                   new BracketHeat(5,  "preliminary", 1),
                   new BracketHeat(6,  "preliminary", 1),
                   new BracketHeat(7,  "preliminary", 1),
                   new BracketHeat(8,  "preliminary", 1),
                   new BracketHeat(9,  "winner",      2),
                   new BracketHeat(10, "winner",      2),
                   new BracketHeat(11, "winner",      2),
                   new BracketHeat(12, "winner",      2),
                   new BracketHeat(13, "loser",       0),
                   new BracketHeat(14, "loser",       0),
                   new BracketHeat(15, "loser",       0),
                   new BracketHeat(16, "loser",       0),
                   new BracketHeat(17, "loser",       1),
                   new BracketHeat(18, "loser",       1),
                   new BracketHeat(19, "loser",       1),
                   new BracketHeat(20, "loser",       1),
                   new BracketHeat(21, "loser",       2),
                   new BracketHeat(22, "loser",       2),
                   new BracketHeat(23, "winner",      3),
                   new BracketHeat(24, "winner",      3),
                   new BracketHeat(25, "loser",       3),
                   new BracketHeat(26, "loser",       3),
                   new BracketHeat(27, "loser",       4),
                   new BracketHeat(28, "winner",      4),
                   new BracketHeat(29, "loser",       5),
                   new BracketHeat(30, "winner",      5),
                 ],
    //"fai64":     [],
    //"fai64de":   []
}

function get_method_descriptor(ddr_pilot_data, ddr_heat_data, ddr_class_data, method, seed, rank, pilot_id) {
    if (method == 0) { // pilot
        var pilot = ddr_pilot_data?.find(obj => {return obj.pilot_id == pilot_id});

        if (pilot) {
            return pilot.callsign;
        } else {
            return false;
        }
    } else if (method == 1) { // heat
        var heat = ddr_heat_data?.find(obj => {return obj.id == seed});

        if (heat) {
            return heat.displayname + " " + __('Rank') + " " + rank;
        } else {
            return false;
        }
    } else if (method == 2) { // class
        var race_class = ddr_class_data?.find(obj => {return obj.id == seed});

        if (race_class) {
            return race_class.displayname + " " + __('Rank') + " " + rank;
        } else {
            return false;
        }
    }
    return false;
}

function build_nextheat(nextheat, nodes, pilots) {
    for (var i in nextheat.slots) {
        if(nextheat.slots[i].pilot_id > 0){
        let pilot = pilots.find(({pilot_id}) => pilot_id === nextheat.slots[i].pilot_id);
        let pilot_name = pilot.callsign;
        let pilot_node_index = nextheat.slots[i].node_index;
        let html = $('<div class="nextheat_pilot">');
        html.append('<span> | </span>');
        html.append('<div class="nextheat_pilot_name">' + pilot_name + ' -' + '</div></div>');
        html.append('<div class="channel-block" data-node="' + pilot_node_index + '"><span class="ch"></span></div>');
        let lastIndex = nextheat.slots.length - 1;

        $('#nextheat_pilot_box').append(html);
        }
    }
}

function update_results_brackets(race_data) {
    Object.keys(race_data.heats).forEach(heatId => {
       var heat = race_data.heats[heatId];
        for (let i = 0; i < heat.leaderboard.by_race_time.length; i++){
            var pilot = heat.leaderboard.by_race_time[i];
            var s = '[data-heat-id="'+ heat.heat_id +'"] [data-pilot-id="'+ pilot.pilot_id +'"]';
            var divHeat = $('[data-heat-id="'+ heat.heat_id +'"]');
            var divPilot = divHeat.find('[data-pilot-id="'+ pilot.pilot_id +'"]');
            divPilot.html(i+1);
        }
    });
}

function build_elimination_brackets(race_bracket_type, race_class_id, ddr_pilot_data, ddr_heat_data, ddr_class_data, ddr_race_data) {

    // clear brackets
    $('#winner_bracket_content').html('');
    $('#loser_bracket_content').html('');

    var elimination_heats = [];

    Object.values(ddr_heat_data).forEach(heat => {
        if (heat.class_id == race_class_id) {
            elimination_heats.push(heat);
        }
    });

    // loop through heats and build brackets
    console.log('There are ' + elimination_heats.length + ' heats');

    for (let i = 0; i < elimination_heats.length; i++) {
        const heat = elimination_heats[i];
        let html = '<div data-heat-id="'+ heat.id +'" class="bracket_race">';
        html += '<div class="bracket_race_title">' + heat.displayname + '</div>';
        html += '<div class="bracket_race_pilots">';

        const filtered_slots = heat.slots.filter(slot => /*slot.seed_id*/true && slot.seed_rank);

        for (let j = 0; j < filtered_slots.length; j++) {
            const slot = filtered_slots[j];
            let pilot;

            if (slot.pilot_id === 0) {
                // try to get the pilot from completed heats
                if (slot.method == 1) {
                    // heat
                    const leaderboard_type = ddr_race_data.heats[slot.seed_id]?.leaderboard.meta.primary_leaderboard;
                    pilot = ddr_race_data.heats[slot.seed_id]?.leaderboard[leaderboard_type].find(p => p.position === slot.seed_rank);
                }
            } else {
                // pilot available
                pilot = ddr_pilot_data.find(p => p.pilot_id === slot.pilot_id);
            }

            if (pilot) {

                html += '<div class="bracket_race_pilot">';

                html += '<div class="pilot_name">' + pilot.callsign + '</div>';

                let pilot_node_index = slot.node_index;
                html += '<div class="channel-block" data-node="'+ pilot_node_index +'"><span class="ch"></span></div>'

                html += '<div data-pilot-id="' + pilot.pilot_id + '" class="pilot_position"></div>';


                html += '</div>';
            } else {
                let method_text = get_method_descriptor(ddr_pilot_data, ddr_heat_data, ddr_class_data, slot.method, slot.seed_id, slot.seed_rank, slot.pilot_id)
                html += '<div class="bracket_race_pilot">';
                html += '<div class="no_pilot">' + method_text + '</div>';
                html += '</div>';
            }
        }

        html += '</div>';
        html += '</div>';

        if (bracket_formats[race_bracket_type] != undefined) {
            let bracket_heat_info = bracket_formats[race_bracket_type][i];

            if (bracket_heat_info.type == "winner" || bracket_heat_info.type == "preliminary") {
                var column_counter = bracket_heat_info.column;
                if ($('#bracket_column_' + column_counter).length == 0) {
                    $('#winner_bracket_content').append('<div id="bracket_column_'+column_counter+'" class="bracket_column"></div>');
                }
                $('#bracket_column_'+column_counter).append( html );
            } else {
                var column_counter = bracket_heat_info.column + 1;
                if ($('#bracket_column_loser_' + column_counter).length == 0) {
                    $('#loser_bracket_content').append('<div id="bracket_column_loser_'+column_counter+'" class="bracket_column"></div>');
                }
                $('#bracket_column_loser_'+column_counter).append( html );
            }
        }
    }
}

