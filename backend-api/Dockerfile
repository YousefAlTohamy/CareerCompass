FROM php:8.4-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libsqlite3-dev \
    zip \
    unzip \
    libzip-dev \
    libicu-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql pdo_sqlite mbstring exif pcntl bcmath gd zip intl

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Add a lightweight entrypoint that clears stale package manifests from bind mounts
# before any Laravel command starts.
COPY docker-entrypoint.sh /usr/local/bin/cc-entrypoint
RUN chmod +x /usr/local/bin/cc-entrypoint

# Install Composer dependencies first for better image-layer reuse.
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

COPY . /app
RUN composer dump-autoload --optimize

# Set proper permissions for Laravel
RUN chown -R www-data:www-data /app/storage /app/bootstrap/cache

# Expose port 9000 and start php-fpm server
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD php -v || exit 1
ENTRYPOINT ["/usr/local/bin/cc-entrypoint"]
CMD ["php-fpm"]
