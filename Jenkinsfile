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