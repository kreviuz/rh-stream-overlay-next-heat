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

    def get_next_heat(heat_id):
        regen_heat = False
        heat = rhapi.db.heat_by_id(rhapi.race.heat)
        if heat.class_id:
            raceclass = rhapi.db.raceclass_by_id(heat.class_id)
            if raceclass.round_type == 1:
                if raceclass.rounds == 0 or heat.group_id + 1 < raceclass.rounds:
                    # Regenerate to new heat + group
                    regen_heat = Database.Heat(
                        name=heat.name,
                        class_id=heat.class_id,
                        group_id=heat.group_id + 1,
                        results=None,
                        status=0,
                        auto_frequency=heat.auto_frequency
                    )

        next_heat_id = rhapi._racecontext.rhdata.get_next_heat_id(heat_id, regen_heat)
        broadcast_next_heat(next_heat_id)

    def broadcast_next_heat(next_heat_id):
        rhapi.ui.broadcast_heats()
        rhapi.ui.socket_broadcast('next_heat_data', next_heat_id)

    rhapi.ui.blueprint_add(bp)

    rhapi.ui.register_panel("kr_overlays", "Kreviuz - OBS Overlays", "settings")
    rhapi.ui.register_markdown("kr_overlays", "Kreviuz Overlays link", "- [Next Heat](/kr_overlays/next_heat)")
