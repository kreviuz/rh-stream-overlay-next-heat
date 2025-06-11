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
        race_kickoff(msg);
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

function build_nextheat(nextheat, nodes, pilots) {
    for (var i in nextheat.slots) {
        if(nextheat.slots[i].pilot_id > 0){
        let pilot = pilots.find(({pilot_id}) => pilot_id === nextheat.slots[i].pilot_id);
        let pilot_name = pilot.callsign;
        let pilot_node_index = nextheat.slots[i].node_index;
        let html = $('<div class="nextheat_pilot">');
        html.append('<div class="nextheat_pilot_name">' + pilot_name + '</div></div>');
        html.append('<div class="channel-block" data-node="' + pilot_node_index + '"><span class="ch"></span></div>');

        $('#nextheat_pilot_box').append(html);
        }
    }
}

