pipeline {
    agent any

    stages {

        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build & Push to Docker Hub') {
            steps {
                echo 'Skipping external build. Building on EC2 directly for now.'
            }
        }

        stage('Deploy to EC2 (k3s)') {
            steps {
                sshagent(['ec2-ssh']) {
                    sh '''
                     ssh -o StrictHostKeyChecking=no ubuntu@16.170.173.185 << 'EOF'
                     
                        # 1. Pull the latest code
                        cd app || exit
                        git pull origin main

                        # 2. Check if k3s is installed, install if missing
                        if ! command -v k3s &> /dev/null; then
                            echo "k3s not found. Installing k3s..."
                            curl -sfL https://get.k3s.io | sh -
                            # Make the kubeconfig readable by the ubuntu user
                            sudo chown ubuntu:ubuntu /etc/rancher/k3s/k3s.yaml
                            sudo chmod 644 /etc/rancher/k3s/k3s.yaml
                            echo "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml" >> ~/.bashrc
                            export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
                            sleep 15 # Give k3s a moment to start
                        else
                            echo "k3s is already installed."
                            export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
                        fi

                        # 3. Build the Docker images directly into k3s's containerd environment
                        echo "Building images locally..."
                        sudo docker build -t 23bcs021/backend-monitoring-backend:latest -f apps/Backend/Dockerfile .
                        sudo docker build -t 23bcs021/backend-monitoring-dashboard:latest -f apps/dashboard/Dockerfile .
                        
                        # Import the docker images into k3s so it can see them
                        sudo docker save 23bcs021/backend-monitoring-backend:latest | sudo k3s ctr images import -
                        sudo docker save 23bcs021/backend-monitoring-dashboard:latest | sudo k3s ctr images import -

                        # 4. Apply the Kubernetes manifests!
                        echo "Applying K8s manifests..."
                        kubectl apply -f k8s/
                     EOF
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment successful 🚀'
        }
        failure {
            echo 'Deployment failed ❌'
        }
    }
}