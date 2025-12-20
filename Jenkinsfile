@Library('discord-hooks') _

pipeline {
  agent any
  options { timestamps() }

  stages {
    stage('Frontend Test') {
      steps {
        script {
          try {
            sh 'docker build -t frontend-test -f frontend/Dockerfile.ci frontend'
            sh 'docker run --rm frontend-test'
            discordNotify(
              credId: 'discord-webhook-url',
              message: "[OK] frontend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
          } catch (e) {
            discordNotify(
              credId: 'discord-webhook-url',
              message: "[NG] frontend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
            throw e
          }
        }
      }
    }

    stage('Frontend Build') {
        steps {
            script {
            sh '''
                docker build -t frontend-build -f frontend/Dockerfile.build frontend
                docker create --name frontend-build-container frontend-build
                rm -rf frontend_dist
                docker cp frontend-build-container:/work/dist ./frontend_dist
                docker rm frontend-build-container
            '''
            }
        }
    }

    stage('Deploy Frontend') {
        steps {
            sh '''
            rsync -av --delete frontend_dist/ \
                deploy@172.31.0.6:/var/www/log-manage/
            '''
            discordNotify(
                credId: 'discord-webhook-url',
                message: "[OK] frontend deployed"
            )
        }
    }

    stage('Backend Test') {
      steps {
        script {
          try {
            sh 'docker build -t backend-test -f backend/Dockerfile.ci backend'
            sh 'docker run --rm backend-test'
            discordNotify(
              credId: 'discord-webhook-url',
              message: "[OK] backend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
          } catch (e) {
            discordNotify(
              credId: 'discord-webhook-url',
              message: "[NG] backend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
            throw e
          }
        }
      }
    }
  }

    stage('Deploy Backend') {
        when {
            branch 'main'
        }
        steps {
            script {
            sh '''
                rsync -av --delete backend/ deploy@172.31.0.6:/home/deploy/log_manage/backend/
            '''
            }
        }
    }

    stage('Restart Backend') {
        when {
            branch 'main'
        }
        steps {
            sh '''
            ssh deploy@172.31.0.6 '
                source /home/deploy/log_manage/venv/bin/activate &&
                pip install -r /home/deploy/log_manage/backend/requirements.txt &&
                sudo systemctl restart log-manage-backend.service
            '
            '''
            discordNotify(
                credId: 'discord-webhook-url',
                message: "[OK] backend deployed"
            )
        }
    }

  post {
    success {
      discordNotify(
        credId: 'discord-webhook-url',
        message: "[OK] pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
      )
    }
    failure {
      discordNotify(
        credId: 'discord-webhook-url',
        message: "[NG] pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
      )
    }
  }
}