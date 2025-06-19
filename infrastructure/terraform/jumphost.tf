data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-bionic-18.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

resource "aws_key_pair" "default" {
  key_name = "deployer-key"
  public_key = var.ssh_public_key
  tags = {
    Name = "Public key for API jumphost (managed by terraform)"
  }
}

# Instance
resource "aws_instance" "jumphost" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.nano"

  key_name = aws_key_pair.default.key_name
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.jumphost.id]

  tags = {
    Name = "Course Catalog API Jumphost"
  }
}

# Public IP
resource "aws_eip" "jumphost" {
  domain = "vpc"
  instance = aws_instance.jumphost.id
  depends_on = [aws_internet_gateway.gw]
}

# SG to get into the DB sgs
resource "aws_security_group" "jumphost" {
  name        = "jumphost-security-group"
  description = "sg for jumphost to get into dev, staging and prod DBs"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "ssh"
    protocol        = "tcp"
    from_port       = 22
    to_port         = 22
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
