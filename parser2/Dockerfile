FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Устанавливаем D-Bus, UPower и все необходимые компоненты
RUN apt-get update && \
    apt-get install -y \
      dbus \
      dbus-x11 \
      upower \
      policykit-1 \
      xvfb \
      wget \
      unzip \
      curl \
      ca-certificates \
      fonts-liberation \
      fonts-dejavu-core \
      libnss3 \
      libatk-bridge2.0-0 \
      libgtk-3-0 \
      libxss1 \
      libasound2 \
      libgbm1 \
      libxrandr2 \
      libasound2 \
      libpangocairo-1.0-0 \
      libatk1.0-0 \
      libcairo-gobject2 \
      libgtk-3-0 \
      libgdk-pixbuf2.0-0 \
      procps \
      sudo \
      dos2unix \
      --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Устанавливаем Google Chrome (совместимый с Puppeteer) - ИСПРАВЛЕННАЯ ВЕРСИЯ
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ИСПРАВЛЯЕМ проблему Puppeteer - устанавливаем переменные среды
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Создаём конфигурацию UPower для Docker (без systemd-logind)
RUN mkdir -p /etc/UPower && \
    echo '[UPower]' > /etc/UPower/UPower.conf && \
    echo 'EnableWattsUpPro=false' >> /etc/UPower/UPower.conf && \
    echo 'NoPollBatteries=false' >> /etc/UPower/UPower.conf && \
    echo 'IgnoreLid=true' >> /etc/UPower/UPower.conf && \
    echo 'UsePercentageForPolicy=true' >> /etc/UPower/UPower.conf && \
    echo 'PercentageLow=10' >> /etc/UPower/UPower.conf && \
    echo 'PercentageCritical=3' >> /etc/UPower/UPower.conf && \
    echo 'PercentageAction=2' >> /etc/UPower/UPower.conf && \
    echo 'TimeLow=1200' >> /etc/UPower/UPower.conf && \
    echo 'TimeCritical=300' >> /etc/UPower/UPower.conf && \
    echo 'TimeAction=120' >> /etc/UPower/UPower.conf && \
    echo 'CriticalPowerAction=PowerOff' >> /etc/UPower/UPower.conf

# Создаём пустые файлы для systemd-logind заглушек
RUN mkdir -p /run/systemd/seats /run/systemd/users /run/systemd/sessions && \
    touch /run/systemd/seats/seat0 && \
    chmod 644 /run/systemd/seats/seat0

# Создаём пользователя с правильными правами
RUN useradd -m -s /bin/bash parser && \
    usermod -aG sudo parser && \
    echo 'parser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Настраиваем D-Bus machine-id (важно!)
RUN dbus-uuidgen > /var/lib/dbus/machine-id

# Создаём директории для D-Bus runtime
RUN mkdir -p /run/user/1000 && \
    chown parser:parser /run/user/1000 && \
    chmod 700 /run/user/1000

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Создаем директории для логов и данных с правильными правами
RUN mkdir -p /app/logs /app/data && \
    chown -R parser:parser /app && \
    chmod -R 755 /app/logs /app/data

COPY start-parser.sh /app/start-parser.sh  
RUN chmod +x /app/start-parser.sh && \
    chown parser:parser /app/start-parser.sh && \
    dos2unix /app/start-parser.sh 2>/dev/null || true

# Переключаемся на пользователя parser
USER parser

# Устанавливаем важные переменные окружения
ENV USER=parser
ENV HOME=/home/parser
ENV XDG_RUNTIME_DIR=/run/user/1000
ENV DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus

CMD ["/app/start-parser.sh"] 