// Ensure we enroll ecs with long resource IDs
// Delete after after date when all new accounts will be enrolled by default (unclear when)
resource "null_resource" "enable_long_ecs_resource_ids" {
  provisioner "local-exec" {
    command = <<EOF
      # enable all ecs long IDs
      aws ecs put-account-setting-default --name serviceLongArnFormat --value enabled
      aws ecs put-account-setting-default --name taskLongArnFormat --value enabled
      aws ecs put-account-setting-default --name containerInstanceLongArnFormat --value enabled
EOF
  }
}
