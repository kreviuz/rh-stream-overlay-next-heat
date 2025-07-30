'''Kreviuz Overlays Plugin'''

import logging

logger = logging.getLogger(__name__)
# import RHUtils
import json

from RHUI import UIField, UIFieldType, UIFieldSelectOption

import requests
import Database
from flask import templating
from flask.blueprints import Blueprint


def initialize(rhapi):
    bp = Blueprint(
        'kr_overlays',
        __name__,
        template_folder='pages',
        static_folder='static',
        static_url_path='/kr_overlays/static'
    )

    @bp.route('/kr_overlays/next_heat')
    def kr_overlays_streamNextUp():
        rhapi.ui.socket_listen('get_next_heat', get_next_heat)
        return templating.render_template('next_heat.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__,
                                          DEBUG=False, num_nodes=8
                                          )

    @bp.route('/kr_overlays/brackets/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamBrackets(bracket_type, class_id):
        return templating.render_template('brackets.html', serverInfo=None, getOption=rhapi.db.option,__=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id, num_nodes=8
        )


    def get_next_heat(heat_id):
        regen_heat = False
        heat = rhapi.db.heat_by_id(rhapi.race.heat)
        if heat.class_id:
            raceclass = rhapi.db.raceclass_by_id(heat.class_id)
            if raceclass.round_type == 1:
                if raceclass.rounds == 0 or heat.group_id + 1 < raceclass.rounds:
                    # Regenerate to new heat + group
                    broadcast_next_heat(heat_id)
                    return

        next_heat_id = rhapi._racecontext.rhdata.get_next_heat_id(heat_id, regen_heat)
        result = rhapi._racecontext.heatautomator.calc_heat(next_heat_id, True)
        displayempty = False
        if result == 'no-heat':
            displayempty = True
        broadcast_next_heat(next_heat_id, displayempty)

    def broadcast_next_heat(next_heat_id, displayempty):
        rhapi.ui.broadcast_heats()
        rhapi.ui.socket_broadcast('next_heat_data', {'displayEmpty': displayempty, 'nextHeatId': next_heat_id})

    rhapi.ui.blueprint_add(bp)

    rhapi.ui.register_panel("kr_overlays", "Kreviuz - OBS Overlays", "settings")
    rhapi.ui.register_markdown("kr_overlays", "Kreviuz Overlays NextHeat link", "- [Next Heat](/kr_overlays/next_heat)")
    rhapi.ui.register_markdown("kr_overlays", "Kreviuz Overlays Brackets link", "- [Brackets](/kr_overlays/brackets/multigp16/1)")
