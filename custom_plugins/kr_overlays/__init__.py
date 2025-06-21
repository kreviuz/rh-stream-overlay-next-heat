'''Kreviuz Overlays Plugin'''

import logging
from src.server.RHAPI import RHAPI

logger = logging.getLogger(__name__)
#import RHUtils
import json

from RHUI import UIField, UIFieldType, UIFieldSelectOption

import requests
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
        next_heat = rhapi._racecontext.rhdata.get_next_heat_id(heat_id, False)
        broadcast_next_heat(next_heat)

    def broadcast_next_heat(next_heat):
        rhapi.ui.broadcast_heats()
        rhapi._racecontext.rhui._socket.emit('next_heat_data', next_heat)

    rhapi.ui.blueprint_add(bp)

    rhapi.ui.register_panel("kr_overlays", "Kreviuz - OBS Overlays", "settings")
    rhapi.ui.register_markdown("kr_overlays", "Kreviuz Overlays link", "- [Next Heat](/kr_overlays/next_heat)")
