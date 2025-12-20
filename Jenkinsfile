@Library('discord-hooks') _

pipeline {
  agent any
  options { timestamps() }

  environment {
    DEPLOY_HOST = '172.31.0.6'
    FRONT_DST   = '/home/deploy/log-manage/frontend'
    BACK_DST    = '/home/deploy/log_manage/backend'
    VENV_PIP    = '/home/deploy/log_manage/backend/venv/bin/pip'
    BACK_SERVICE= 'log-manage-backend.service'
    SSH_CRED_ID = 'ssh-private-key'
    DISCORD_CRED= 'discord-webhook-url'
  }


  stages {
    stage('Frontend Test') {
      steps {
        script {
          try {
            sh 'docker build -t frontend-test -f frontend/Dockerfile.ci frontend'
            sh 'docker run --rm frontend-test'
            discordNotify(credId: env.DISCORD_CRED, message: "[OK] frontend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: env.DISCORD_CRED, message: "[NG] frontend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Frontend Build') {
      when { branch 'main' }
      steps {
        script {
          try {
            sh '''
              set -eu
              docker build -t frontend-build -f frontend/Dockerfile.build frontend
              CID="$(docker create frontend-build)"
              rm -rf frontend_dist
              docker cp "${CID}:/work/dist" ./frontend_dist
              docker rm -f "${CID}"
            '''
            discordNotify(credId: env.DISCORD_CRED, message: "[OK] frontend build OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: env.DISCORD_CRED, message: "[NG] frontend build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Deploy Frontend') {
      when { branch 'main' }
      steps {
        sshagent(credentials: [env.SSH_CRED_ID]) {
          script {
            try {
              sh '''
                set -eu
                rsync -av --delete -e "ssh -o StrictHostKeyChecking=no" frontend_dist/ \
                  deploy@${DEPLOY_HOST}:${FRONT_DST}/
              '''
              discordNotify(credId: env.DISCORD_CRED, message: "[OK] frontend deployed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
            } catch (e) {
              discordNotify(credId: env.DISCORD_CRED, message: "[NG] frontend deploy FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
              throw e
            }
          }
        }
      }
    }

    stage('Backend Test') {
      steps {
        script {
          try {
            sh 'docker build -t backend-test -f backend/Dockerfile.ci backend'
            sh 'docker run --rm backend-test'
            discordNotify(credId: env.DISCORD_CRED, message: "[OK] backend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
          } catch (e) {
            discordNotify(credId: env.DISCORD_CRED, message: "[NG] backend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
            throw e
          }
        }
      }
    }

    stage('Deploy & Restart Backend') {
      when { branch 'main' }
      steps {
        sshagent(credentials: [env.SSH_CRED_ID]) {
          script {
            try {
              sh '''
                set -eu
                rsync -av --delete -e "ssh -o StrictHostKeyChecking=no" backend/ \
                  deploy@${DEPLOY_HOST}:${BACK_DST}/

                ssh -o StrictHostKeyChecking=no deploy@${DEPLOY_HOST} "
                  set -eu
                  ${VENV_PIP} install -r ${BACK_DST}/requirements.txt
                  sudo systemctl restart ${BACK_SERVICE}
                "
              '''
              discordNotify(credId: env.DISCORD_CRED, message: "[OK] backend deployed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
            } catch (e) {
              discordNotify(credId: env.DISCORD_CRED, message: "[NG] backend deploy FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
              throw e
            }
          }
        }
      }
    }
  }

  post {
    success {
      discordNotify(credId: env.DISCORD_CRED, message: "[OK] pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
    }
    failure {
      discordNotify(credId: env.DISCORD_CRED, message: "[NG] pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n${env.BUILD_URL}")
    }
  }
}
