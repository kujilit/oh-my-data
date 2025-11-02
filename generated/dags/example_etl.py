from airflow import DAG
from airflow.decorators import task
from datetime import datetime
from my_utils.db import db_query, db_insert

default_args = {"start_date": datetime(2025, 1, 1)}

with DAG("example_etl", schedule_interval=None, default_args=default_args, catchup=False) as dag:
    @task
    def extract_users():
        return db_query("SELECT * FROM users")

    @task
    def filter_active(data):
        return [x for x in data if x['active']]

    @task
    def load_to_postgres(data):
        db_insert("active_users", data)

    extract_users() >> filter_active() >> load_to_postgres()
