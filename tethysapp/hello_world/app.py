from tethys_apps.base import TethysAppBase, url_map_maker
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting
from .controllers import minio_admin

class HelloWorld(TethysAppBase):
    """
    Tethys app class for Hello World.
    """
    name = 'hello_world'
    description = ''
    package = 'hello_world'  
    index = 'home'  
    icon = f'{package}/images/icon.gif'
    root_url = 'hello-world'
    color = '#1abc9c'
    tags = ''
    enable_feedback = False
    feedback_emails = []
    
    def persistent_store_settings(self):
        """
        Define persistent store settings.
        """
        ps_settings = (
                PersistentStoreDatabaseSetting(
                    name='postgres',
                    description='database postgres',
                    initializer='hello_world.models.init_my_db',
                    required=True
                ),
        )
        return ps_settings

    def url_maps(self):
        """
        Add URL Maps.
        """
        url_maps = (
            url_map_maker(
                name='minio_admin',
                url='hello-world/minio-admin',
                controller='tethysapp.hello_world.controllers.minio_admin'
            ),
            url_map_maker(
                name='minio_list_api',
                url='hello-world/api/minio-list',
                controller='tethysapp.hello_world.controllers.minio_list_api'
            ),
        )
        return url_maps