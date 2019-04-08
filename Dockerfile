FROM alpine:3.9

RUN echo '@edgetesting http://dl-cdn.alpinelinux.org/alpine/edge/testing' \
  >> /etc/apk/repositories

RUN apk --no-cache add \
    nodejs \
    npm \
    ffmpeg \
    android-tools@edgetesting \
  && npm install -g \
    npm@latest \
    mocha@6.1.1 \
  # Clean up obsolete files:
  && rm -rf \
    /tmp/* \
    /root/.npm

# Avoid permission issues with host mounts by assigning a user/group with
# uid/gid 1000 (usually the ID of the first user account on GNU/Linux):
RUN adduser -D -u 1000 mocha

USER mocha

WORKDIR /opt

COPY wait-for.sh /usr/local/bin/wait-for

ENTRYPOINT ["wait-for", "--", "mocha"]
