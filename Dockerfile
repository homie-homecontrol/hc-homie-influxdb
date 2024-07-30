FROM  --platform=$BUILDPLATFORM node:16-alpine as serverbuild
ARG BUILDPLATFORM
COPY . /service/
WORKDIR /service/
RUN yarn --pure-lockfile
RUN yarn run gulp prod

FROM node:16-alpine
COPY --from=serverbuild /service/dist/ /service/
WORKDIR /service/
RUN yarn --pure-lockfile  --production=true

# Defining volumes and env vars will make them show up in (some) GUI based docker tools
VOLUME /service/data
ENV HCINFL_CTRL_ID "influx-ctrl-1"
ENV HCINFL_CTRL_NAME "homie to influxdb controller"
ENV HCINFL_MQTT_URL "mqtt://mqttserver:1883"
ENV HCINFL_MQTT_TOPIC_ROOT "homie"
ENV HCINFL_CONFIG_FOLDER "./data"
ENV HCINFL_INFLUXDB_URL "http://influxdb:8086"
ENV HCINFL_INFLUXDB_TOKEN "token..."
ENV HCINFL_INFLUXDB_ORG "org..."
ENV HCINFL_INFLUXDB_BUCKET "bucket..."
ENV HCINFL_LOGLEVEL "debug"

WORKDIR /service/
CMD ["node", "service.js"]
