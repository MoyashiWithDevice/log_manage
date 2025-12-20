@Library('discord-hooks') _

pipeline {
  agent any
  options { timestamps() }

  stages {
    stage('Frontend Test') {
      steps {
        script {
          try {
            sh 'docker run --rm ... frontend-test'
            discordNotify(
              credId: 'discord-webhook-url',
              message: "✅ frontend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
          } catch (e) {
            discordNotify(
              credId: 'discord-webhook-url',
              message: "❌ frontend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
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
            sh 'docker run --rm ... backend-test'
            discordNotify(
              credId: 'discord-webhook-url',
              message: "✅ backend test OK: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
          } catch (e) {
            discordNotify(
              credId: 'discord-webhook-url',
              message: "❌ backend test FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
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
        message: "🎉 pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
      )
    }
    failure {
      discordNotify(
        credId: 'discord-webhook-url',
        message: "🔥 pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
      )
    }
  }
}
