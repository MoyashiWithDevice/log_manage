@Library('discord-hooks') _

pipeline {
  agent { label 'default' }   // Vault CSI マウントのPodTemplateを使う
  options { timestamps() }

  environment {
    DEPLOY_HOST = '172.31.0.6'
    FRONT_DST   = '/home/deploy/log_manage/frontend'
    BACK_DST    = '/home/deploy/log_manage/backend'
    VENV_PIP    = '/home/deploy/log_manage/backend/venv/bin/pip'
    BACK_SERVICE= 'log-manage-backend.service'

    SSH_KEY_PATH      = '/mnt/secrets/private_key'
    DISCORD_WEBHOOK_F = '/mnt/secrets/discord_webhook_url'
  }

  stages {
    stage('Frontend Test') {
      steps {
        script {
          def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
          try {
            sh 'docker build -t frontend-test -f frontend/Dockerfile.ci frontend'
            sh 'docker run --rm frontend-test'
            discordNotify(credId: WEBHOOK, message: "[OK] frontend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: WEBHOOK, message: "[NG] frontend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Frontend Build') {
      when { branch 'main' }
      steps {
        script {
          def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
          try {
            sh '''
              set -eu
              docker build -t frontend-build -f frontend/Dockerfile.ci frontend
              CID="$(docker create frontend-build)"
              rm -rf frontend_dist
              docker cp "${CID}:/work/dist" ./frontend_dist
              docker rm -f "${CID}"
            '''
            discordNotify(credId: WEBHOOK, message: "[OK] frontend build OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: WEBHOOK, message: "[NG] frontend build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Deploy Frontend') {
      when { branch 'main' }
      steps {
        script {
          def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
          try {
            sh '''
              set -eu
              chmod 600 "${SSH_KEY_PATH}"

              rsync -av --delete \
                -e "ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no" \
                frontend_dist/ deploy@${DEPLOY_HOST}:${FRONT_DST}/
            '''
            discordNotify(credId: WEBHOOK, message: "[OK] frontend deployed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: WEBHOOK, message: "[NG] frontend deploy FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Backend Test') {
      steps {
        script {
          def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
          try {
            sh 'docker build -t backend-test -f backend/Dockerfile.ci backend'
            sh 'docker run --rm backend-test'
            discordNotify(credId: WEBHOOK, message: "[OK] backend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: WEBHOOK, message: "[NG] backend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Deploy & Restart Backend') {
      when { branch 'main' }
      steps {
        script {
          def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
          try {
            sh '''
              set -eu
              chmod 600 "${SSH_KEY_PATH}"

              rsync -av --delete \
                -e "ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no" \
                backend/ deploy@${DEPLOY_HOST}:${BACK_DST}/

              ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no deploy@${DEPLOY_HOST} <<EOS
set -eu
cd ${BACK_DST}

if [ ! -d venv ]; then
  python3 -m venv venv
fi

./venv/bin/python -m pip install --upgrade pip
${VENV_PIP} install -r ${BACK_DST}/requirements.txt
sudo systemctl restart ${BACK_SERVICE}
EOS
            '''
            discordNotify(credId: WEBHOOK, message: "[OK] backend deployed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: WEBHOOK, message: "[NG] backend deploy FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }
  }

  post {
    success {
      script {
        def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
        discordNotify(credId: WEBHOOK, message: "[OK] pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
      }
    }
    failure {
      script {
        def WEBHOOK = sh(script: 'cat "${DISCORD_WEBHOOK_F}"', returnStdout: true).trim()
        discordNotify(credId: WEBHOOK, message: "[NG] pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
      }
    }
  }
}