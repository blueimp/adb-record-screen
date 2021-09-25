FROM alpine:3.14

RUN apk --no-cache add \
  tini \
  nodejs \
  npm \
  ffmpeg \
  android-tools \
  && npm install -g \
  npm@latest \
  mocha@9 \
  # Clean up obsolete files:
  && rm -rf \
  /tmp/* \
  /root/.npm

# Avoid permission issues with host mounts by assigning a user/group with
# uid/gid 1000 (usually the ID of the first user account on GNU/Linux):
RUN adduser -D -u 1000 mocha

USER mocha

WORKDIR /app

COPY wait-for-hosts.sh /usr/local/bin/wait-for-hosts

ENTRYPOINT ["tini", "-g", "--", "wait-for-hosts", "--", "mocha"]
