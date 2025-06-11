'''Kreviuz Overlays Plugin'''

import logging
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
        return templating.render_template('next_heat.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False, num_nodes=8
        )

    rhapi.ui.blueprint_add(bp)

    rhapi.ui.register_panel("kr_overlays", "Kreviuz - OBS Overlays", "settings")
    rhapi.ui.register_markdown("kr_overlays", "Kreviuz Overlays link", "- [Next Heat](/kr_overlays/next_heat)")
